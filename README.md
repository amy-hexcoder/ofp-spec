# Open Funding Protocol (OPENFP)

How a website tells AI agents what it accepts for the use of its content, and how an agent says
who it is and settles up.

- **[SPEC.md](SPEC.md)** is the specification.
- **[schemas/](schemas)** holds the JSON Schemas for every document in it.
- **[fixtures/](fixtures)** holds valid and invalid examples, plus signing test vectors with the
  exact signature base bytes, so two implementations can prove they agree.

MIT licensed. There is no central registry, no allowlist, and no certification: implement it and
you're done. [copen.dev](https://copen.dev) is the reference registry, and gets no special
treatment here.

## Install

```bash
npm install @openfp/spec
```

```ts
import { OPENFP_VERSION, WELL_KNOWN_PATH, isSettledMethod, verifyRequest, signRequest } from "@openfp/spec";
import manifestSchema from "@openfp/spec/schemas/manifest.schema.json" with { type: "json" };
```

The package ships the types, the discovery helpers, and both sides of the request signing, so a
registry and an agent build the same signature base from the same code.

## For site owners

Serve this at `https://yourdomain/.well-known/openfp.json` and you are discoverable:

```json
{ "openfp": "0.3", "manifest": "https://<your registry>/api/v1/manifest/<your site id>" }
```

A registry (such as [copen.dev](https://copen.dev)) generates the snippets for your stack, but
nothing stops you serving a full manifest yourself.

## For agent builders

1. Collect manifests while you crawl: the well-known file, a `Link: <...>; rel="openfp"` header, or
   `<link rel="openfp">` in the head. Or resolve a whole crawl at once with a registry lookup.
2. Sign your requests so the operator behind the agent is verifiable. Test vectors are in
   `fixtures/signing/`.
3. Settle once per task, weighting each site by what you actually used.

## Contributing

Changes go by pull request, with the schemas and fixtures updated in the same change. Commits are
signed off under the DCO (`git commit -s`). See [GOVERNANCE.md](GOVERNANCE.md), and
[TRADEMARK.md](TRADEMARK.md) for which names are free to use.

```bash
npm install
npm run build
npm test      # validates every fixture against the schemas and checks the signing vectors
```
