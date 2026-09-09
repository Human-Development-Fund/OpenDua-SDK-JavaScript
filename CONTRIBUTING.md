# Contributing

Thank you for improving the OpenDua JavaScript SDK.

## Before you start

Use GitHub Issues to describe a defect or proposed change before opening a
large pull request. Keep content corrections separate from SDK changes; this
repository consumes the public OpenDua contract but does not own the dataset.

Report security problems through the private route in
[`SECURITY.md`](SECURITY.md).

## Local checks

Use Node.js 20 or later. Install the locked dependencies and run the complete
check:

```sh
npm ci
npm run check
```

The check verifies generated API types, TypeScript, tests, both package builds,
package exports, and the files in the npm archive.

## API contract changes

`contracts/openapi.json` is the source for generated TypeScript declarations.
Do not edit `src/generated/schema.ts` by hand. After an intentional contract
update, run:

```sh
npm run generate
npm run check
```

Commit the contract and generated declaration together. Add or update a frozen
fixture and a client test when the public response shape changes.

## Pull requests

- Keep each pull request focused on one change.
- Add tests for behavior changes.
- Update the README and changelog when users must change their code.
- Use a Conventional Commit subject, such as `fix: handle empty search pages`.
- Do not commit generated archives, `dist`, or `node_modules`.
