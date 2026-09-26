# Changelog

## 0.4.2

- **`payouts_enabled`** on the manifest: whether the recipient can currently withdraw what they are
  paid. A site may accept before it can withdraw, so this is advisory and optional. Agents that
  care about the difference can read it; the rest can ignore it.

## 0.4.0

Money was the only thing an agent could send. Now it can also say something.

- **`interactions`** in the manifest: which of `feedback`, `review` and `question` a site accepts,
  whether questions get answered, and what asking costs.
- **`POST /api/v1/messages`**: one endpoint for all three kinds. Identity comes from the request
  signature, the same as settlements, so a publisher sees which operator sent it.
- **Priced questions**: a question can carry a price, settled from an operator balance or by
  checkout. Until it is paid it stays `awaiting_payment` and is not delivered.
- **Answers**: a publisher can register an endpoint on their own domain, so their own agent answers
  and the reply comes back inline. Otherwise the question waits in their inbox and the asking agent
  polls the status URL.
- **Reviews** carry a `visibility` of `private` or `agents`. Nothing is published to people.

## 0.3.0

First public draft, and the first version with an identity layer.

- **Renamed the discovery surface to the protocol**: `/.well-known/ofp.json`, `rel="ofp"`,
  `<meta name="ofp">`, `Link: <manifest>; rel="ofp"`. Earlier drafts used vendor-specific names.
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
