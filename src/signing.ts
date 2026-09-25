/**
 * Request signing for OPENFP, a practical subset of RFC 9421 (HTTP Message Signatures).
 *
 * Covered components: "@method", "@target-uri" and, when there is a body, "content-digest".
 * Algorithm: ed25519. Both sides of the protocol build the same signature base from these
 * helpers, so a mismatch is a bug in one implementation rather than a disagreement about format.
 */
import { createHash, createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";

export const SIGNATURE_MAX_AGE_SECONDS = 300;
export const SIGNATURE_LABEL = "sig1";

export type SignatureParams = {
  components: string[];
  created: number;
  keyid: string;
  alg: string;
  params: string;
  signature: Buffer;
  label: string;
};

const fromBase64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function contentDigest(body: string): string {
  return `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;
}

export function buildSignatureBase(input: {
  method: string;
  url: string;
  components: string[];
  params: string;
  headers: Record<string, string>;
}): string {
  const lines = input.components.map((component) => {
    if (component === "@method") return `"@method": ${input.method.toUpperCase()}`;
    if (component === "@target-uri") return `"@target-uri": ${input.url}`;
    return `"${component}": ${input.headers[component] ?? ""}`;
  });
  lines.push(`"@signature-params": ${input.params}`);
  return lines.join("\n");
}

export function parseSignatureHeaders(get: (name: string) => string | null): SignatureParams | null {
  const input = get("signature-input");
  const sig = get("signature");
  if (!input || !sig) return null;

  const m = input.match(/^([A-Za-z0-9_-]+)=\(([^)]*)\)(.*)$/);
  if (!m) return null;
  const [, label, componentList, params] = m;

  const sigMatch = sig.match(new RegExp(`${label}=:([^:]+):`));
  if (!sigMatch) return null;

  const created = Number(params.match(/created=(\d+)/)?.[1] ?? 0);
  const keyid = params.match(/keyid="([^"]+)"/)?.[1] ?? "";
  if (!keyid || !created) return null;

  return {
    label,
    components: [...componentList.matchAll(/"([^"]+)"/g)].map((c) => c[1]),
    created,
    keyid,
    alg: params.match(/alg="([^"]+)"/)?.[1] ?? "ed25519",
    params: `(${componentList})${params}`,
    signature: fromBase64(sigMatch[1]),
  };
}

export function publicKeyFromBase64(publicKey: string) {
  return createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: fromBase64(publicKey).toString("base64url") },
    format: "jwk",
  });
}

export function privateKeyFromBase64(privateKey: string, publicKey: string) {
  return createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: fromBase64(privateKey).toString("base64url"),
      x: fromBase64(publicKey).toString("base64url"),
    },
    format: "jwk",
  });
}

/** Client side: returns the headers to send with a signed request. */
export function signRequest(input: {
  method: string;
  url: string;
  body?: string;
  keyid: string;
  privateKey: string;
  publicKey: string;
  created?: number;
}): Record<string, string> {
  const created = input.created ?? Math.floor(Date.now() / 1000);
  const hasBody = typeof input.body === "string" && input.body.length > 0;
  const components = hasBody ? ["@method", "@target-uri", "content-digest"] : ["@method", "@target-uri"];
  const params = `(${components.map((c) => `"${c}"`).join(" ")});created=${created};keyid="${input.keyid}";alg="ed25519"`;
  const headers: Record<string, string> = {};
  if (hasBody) headers["content-digest"] = contentDigest(input.body!);

  const base = buildSignatureBase({ method: input.method, url: input.url, components, params, headers });
  const signature = nodeSign(null, Buffer.from(base, "utf8"), privateKeyFromBase64(input.privateKey, input.publicKey));

  return {
    ...(hasBody ? { "Content-Digest": headers["content-digest"] } : {}),
    "Signature-Input": `${SIGNATURE_LABEL}=${params}`,
    Signature: `${SIGNATURE_LABEL}=:${signature.toString("base64")}:`,
  };
}

export type VerifyOutcome =
  | { ok: true; keyid: string }
  | { ok: false; code: "unsigned" | "malformed" | "unknown_key" | "revoked" | "stale" | "digest_mismatch" | "bad_signature"; message: string };

/** Server side: verify a signed request against a key looked up by keyid. */
export async function verifyRequest(
  req: { method: string; url: string; header: (name: string) => string | null },
  body: string | null,
  lookupKey: (keyid: string) => Promise<{ public_key: string; revoked_at: string | null } | null>,
  now = Math.floor(Date.now() / 1000),
): Promise<VerifyOutcome> {
  const parsed = parseSignatureHeaders(req.header);
  if (!parsed) {
    return req.header("signature") || req.header("signature-input")
      ? { ok: false, code: "malformed", message: "Signature headers are present but couldn't be parsed." }
      : { ok: false, code: "unsigned", message: "Request is not signed." };
  }
  if (parsed.alg !== "ed25519") return { ok: false, code: "malformed", message: `Unsupported algorithm: ${parsed.alg}` };
  if (Math.abs(now - parsed.created) > SIGNATURE_MAX_AGE_SECONDS) {
    return { ok: false, code: "stale", message: `Signature is outside the ${SIGNATURE_MAX_AGE_SECONDS}s window.` };
  }

  const hasBody = typeof body === "string" && body.length > 0;
  if (hasBody) {
    if (!parsed.components.includes("content-digest")) {
      return { ok: false, code: "malformed", message: "Requests with a body must cover content-digest." };
    }
    if (req.header("content-digest") !== contentDigest(body!)) {
      return { ok: false, code: "digest_mismatch", message: "Content-Digest doesn't match the body." };
    }
  }

  const key = await lookupKey(parsed.keyid);
  if (!key) return { ok: false, code: "unknown_key", message: `No registered key with id ${parsed.keyid}.` };
  if (key.revoked_at) return { ok: false, code: "revoked", message: "That key has been revoked." };

  const headers: Record<string, string> = {};
  for (const c of parsed.components) if (!c.startsWith("@")) headers[c] = req.header(c) ?? "";
  const base = buildSignatureBase({ method: req.method, url: req.url, components: parsed.components, params: parsed.params, headers });

  let valid = false;
  try {
    valid = nodeVerify(null, Buffer.from(base, "utf8"), publicKeyFromBase64(key.public_key), parsed.signature);
  } catch {
    valid = false;
  }
  return valid ? { ok: true, keyid: parsed.keyid } : { ok: false, code: "bad_signature", message: "Signature didn't verify." };
}
