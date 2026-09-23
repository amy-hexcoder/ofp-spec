/**
 * Conformance checks for the spec itself: every fixture validates against the schema it claims,
 * and the signing vectors verify. Implementations should run these too.
 */
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync, readdirSync } from "node:fs";
import { verifyRequest, contentDigest, buildSignatureBase } from "../src/signing.js";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const manifestSchema = ajv.compile(load("../schemas/manifest.schema.json"));
const requestSchema = ajv.compile(load("../schemas/settlement-request.schema.json"));

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  console.log(ok ? `ok   ${label}` : `FAIL ${label} ${detail ? JSON.stringify(detail) : ""}`);
  if (!ok) failures++;
};

for (const file of readdirSync(new URL("../fixtures/manifests", import.meta.url))) {
  const manifest = load(`../fixtures/manifests/${file}`);
  const shouldPass = !file.startsWith("invalid-");
  const valid = manifestSchema(manifest);
  check(`manifest ${file}`, valid === shouldPass, valid ? undefined : manifestSchema.errors?.slice(0, 2));
}

const requests = load("../fixtures/settlement-requests.json") as Record<string, { valid: boolean; body: unknown }>;
for (const [name, fixture] of Object.entries(requests)) {
  check(`settlement request ${name}`, requestSchema(fixture.body) === fixture.valid, requestSchema.errors?.slice(0, 1));
}

// Signing vectors.
for (const file of ["ed25519-post.json", "ed25519-get.json"]) {
  const v = load(`../fixtures/signing/${file}`);
  const headers = new Map(Object.entries(v.request.headers).map(([k, val]) => [k.toLowerCase(), String(val)]));
  const outcome = await verifyRequest(
    { method: v.request.method, url: v.request.url, header: (n) => headers.get(n.toLowerCase()) ?? null },
    v.request.body ?? null,
    async (keyid) => (keyid === v.key.keyid ? { public_key: v.key.public_key, revoked_at: null } : null),
    v.created, // fixtures are fixed in time, so verify as of the moment they were signed
  );
  check(`signature verifies: ${file}`, outcome.ok === true, outcome);

  if (v.expected) {
    check(`content digest matches: ${file}`, contentDigest(v.request.body) === v.expected.content_digest);
    const base = buildSignatureBase({
      method: v.request.method,
      url: v.request.url,
      components: ["@method", "@target-uri", "content-digest"],
      params: headers.get("signature-input")!.replace(/^sig1=/, ""),
      headers: { "content-digest": headers.get("content-digest")! },
    });
    check(`signature base matches: ${file}`, base === v.expected.signature_base);
  }
}

// A tampered body must not verify.
const post = load("../fixtures/signing/ed25519-post.json");
const tamperedHeaders = new Map(Object.entries(post.request.headers).map(([k, val]) => [k.toLowerCase(), String(val)]));
const tampered = await verifyRequest(
  { method: "POST", url: post.request.url, header: (n) => tamperedHeaders.get(n.toLowerCase()) ?? null },
  post.request.body.replace("500", "50000"),
  async () => ({ public_key: post.key.public_key, revoked_at: null }),
  post.created,
);
check("tampered body rejected", tampered.ok === false && tampered.code === "digest_mismatch", tampered);

// An expired signature must not verify.
const stale = await verifyRequest(
  { method: "POST", url: post.request.url, header: (n) => tamperedHeaders.get(n.toLowerCase()) ?? null },
  post.request.body,
  async () => ({ public_key: post.key.public_key, revoked_at: null }),
  Math.floor(Date.now() / 1000) + 10_000,
);
check("stale signature rejected", stale.ok === false && stale.code === "stale", stale);

// A revoked key must not verify.
const revoked = await verifyRequest(
  { method: "POST", url: post.request.url, header: (n) => tamperedHeaders.get(n.toLowerCase()) ?? null },
  post.request.body,
  async () => ({ public_key: post.key.public_key, revoked_at: "2026-01-01T00:00:00Z" }),
  post.created,
);
check("revoked key rejected", revoked.ok === false && revoked.code === "revoked", revoked);

console.log(failures === 0 ? "\nAll conformance checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
