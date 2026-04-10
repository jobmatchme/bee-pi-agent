# `@jobmatchme/bee-pi-agent`

`bee-pi-agent` is a Bee Dance speaking worker runtime that executes coding-agent
turns over a local Unix socket.

It is intended to sit behind `@jobmatchme/bee-worker-sidecar`: the agent speaks
Bee Dance envelopes locally, while the sidecar handles NATS-facing transport and
subject routing.

## What this package does

- listens on a Unix socket for framed Bee Dance envelopes
- responds to `protocol.hello` with `protocol.welcome`
- accepts `turn.start` and `turn.cancel` commands
- executes turns with the familiar `pi-*` coding-agent tool stack
- emits Bee Dance event envelopes such as `run.started`, `item.appended`,
  `item.updated`, `run.completed`, and `run.failed`

## What this package does not do

- no direct NATS connection
- no Slack transport or Slack formatting
- no gateway responsibilities

## Design intent

The package is the local execution half of a two-container pod shape:

- `bee-pi-agent` owns agent execution and local state
- `bee-worker-sidecar` owns NATS connectivity and Bee subject routing

That keeps the agent reusable for deployments that want Bee Dance semantics
without forcing every worker implementation to speak NATS directly.

## Upstream provenance

This package is derived in part from
[`pi-mom`](https://github.com/badlogic/pi-mono/tree/main/packages/mom) by Mario
Zechner. The upstream package is MIT licensed, and selected files in this
package were copied or adapted under that license.

See [UPSTREAM.md](./UPSTREAM.md) for file-level provenance details.

## Socket protocol

`bee-pi-agent` exchanges framed Bee Dance envelopes over a Unix socket. The
expected local flow is:

- sidecar sends `protocol.hello`
- agent replies with `protocol.welcome`
- sidecar sends `turn.start`
- agent streams event envelopes back on the same socket
- sidecar may send `turn.cancel`

The default socket path is `/var/run/bee/worker.sock`.

## Run locally

```bash
npm install
npm run build
BEE_PI_AGENT_WORKSPACE_ROOT=/workspace \
BEE_PI_AGENT_SOCKET=/tmp/bee-pi-agent.sock \
node dist/main.js
```

## Environment

Primary variables:

- `BEE_PI_AGENT_WORKSPACE_ROOT` required workspace root for this worker instance
- `BEE_PI_AGENT_WORKSPACE_CWD` optional working directory inside the workspace
- `BEE_PI_AGENT_STATE_DIR` optional worker state directory
- `BEE_PI_AGENT_MEMORY_FILE` optional memory file path
- `BEE_PI_AGENT_SKILLS_DIR` optional skills directory path
- `BEE_PI_AGENT_SANDBOX` optional `host` or `docker:<container>`
- `BEE_PI_AGENT_DOCKER_WORKSPACE_ROOT` optional visible workspace root inside docker, default `/workspace`
- `BEE_PI_AGENT_SYSTEM_PROMPT_APPEND` optional additional fixed instructions
- `BEE_PI_AGENT_BLOB_STORE_ROOT` optional blob-store root for attachments and artifacts
- `BEE_PI_AGENT_AUTH_FILE` optional auth file override
- `BEE_PI_AGENT_MODEL_PROVIDER` optional provider override
- `BEE_PI_AGENT_MODEL_ID` optional model override
- `BEE_PI_AGENT_TOOL_MODULES` optional comma-separated extra tool modules
- `BEE_PI_AGENT_SOCKET` optional Unix socket path, default `/var/run/bee/worker.sock`

For OAuth-backed OpenAI usage with a `pi-ai` `auth.json`, use
`BEE_PI_AGENT_MODEL_PROVIDER=openai-codex`. Plain `openai` expects an API key
based provider flow instead.

For migration convenience, the older `PI_AGENT_WORKER_*` variables are still
accepted as fallbacks.

## Docker image

A Dockerfile is included for runtime image builds. Build it locally with:

```bash
docker build -t bee-pi-agent:local .
```

The image is designed to be paired with `bee-worker-sidecar` in the same pod.

## Helm chart

A reusable Helm chart is included under [`charts/bee-pi-agent`](./charts/bee-pi-agent).
The chart deploys:

- one `bee-pi-agent` container
- one `bee-worker-sidecar` container
- one shared socket volume mounted at `/var/run/bee`

It also supports the same workspace, auth, and git bootstrap patterns that were
used in the earlier `pi-agent-worker` deployment.

## License

MIT
