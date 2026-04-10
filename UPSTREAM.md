# Upstream Provenance

`@jobmatchme/bee-pi-agent` is a standalone package derived in part from
[`@mariozechner/pi-mom`](https://github.com/badlogic/pi-mono/tree/main/packages/mom)
in the upstream `pi-mono` repository.

Upstream base:

- repository: `https://github.com/badlogic/pi-mono`
- package: `packages/mom`
- upstream package page: `https://github.com/badlogic/pi-mono/tree/main/packages/mom`
- upstream license: MIT

Copied or directly adapted sources in this package:

- `src/context.ts`
  - adapted from `packages/mom/src/context.ts`
- `src/sandbox.ts`
  - adapted from `packages/mom/src/sandbox.ts`
- `src/tools/attach.ts`
  - adapted from `packages/mom/src/tools/attach.ts`
- `src/tools/bash.ts`
  - adapted from `packages/mom/src/tools/bash.ts`
- `src/tools/edit.ts`
  - adapted from `packages/mom/src/tools/edit.ts`
- `src/tools/read.ts`
  - adapted from `packages/mom/src/tools/read.ts`
- `src/tools/truncate.ts`
  - adapted from `packages/mom/src/tools/truncate.ts`
- `src/tools/write.ts`
  - adapted from `packages/mom/src/tools/write.ts`
- `src/worker.ts`
  - structurally derived from `packages/mom/src/agent.ts`

Key intentional divergences from `pi-mom`:

- removes all Slack transport and Slack-specific orchestration
- exposes the runtime as a Bee Dance worker over a local Unix socket
- keeps NATS outside the worker and delegates it to `bee-worker-sidecar`
- treats attachments and artifacts as blob references
- uses worker-owned session directories rather than channel-owned state
