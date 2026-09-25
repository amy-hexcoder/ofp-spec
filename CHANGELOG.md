# Changelog

## 0.3.0

First public draft, and the first version with an identity layer.

- **Renamed the discovery surface to the protocol**: `/.well-known/openfp.json`, `rel="openfp"`,
  `<meta name="openfp">`, `Link: <manifest>; rel="openfp"`. Earlier drafts used vendor-specific names.
- **`payment.methods`** is an ordered list. Registry-settled methods sit alongside funding
  channels the site already uses (GitHub Sponsors, Open Collective and so on), following npm's
  `funding` convention: the type can always be inferred from the URL.
- **`basis`** says what the money is for: `voluntary`, `usage` (with a published `rate`), or
  `agreement` (settled outside this protocol).
- **Operator identity**: agents sign requests with Ed25519 keys under RFC 9421 HTTP Message
  Signatures, so `operator` stops being a self-asserted string. Unsigned requests remain valid
  and are simply reported as unverified.
- **Balances**: a verified operator can hold a balance with a registry and settle synchronously,
  with no checkout page and no human in the loop.
- **Batch settlement**: one payment across many sites, split by weight.
- Vocabulary throughout is funding and settlement, not tipping.
