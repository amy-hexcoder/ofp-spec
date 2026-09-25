# Governance

OPENFP is a small specification, and governance is deliberately lightweight until there is more than
one serious implementation.

- **Changes** happen by pull request against this repository. Anything that changes the wire
  format needs a linked issue describing the problem, at least one implementation that has tried
  it, and an update to the JSON Schemas and fixtures in the same PR.
- **Versioning** is `MAJOR.MINOR`, carried in the `openfp` field of every manifest. Minor versions
  add optional fields; agents ignore what they don't recognise. Major versions may remove or
  change the meaning of a field, and agents should fail closed on an unknown major version.
- **Contributions** are accepted under the DCO: sign off your commits with `git commit -s`. There
  is no CLA, and no copyright assignment.
- **Registries** are not privileged. The protocol has no central registry, no allowlist and no
  certification. `copen.dev` is the reference implementation and gets no special treatment in the
  spec; anything a registry needs is a manifest field, not a hard-coded hostname.
