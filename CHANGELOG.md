# Changelog

## 0.1.13

- add configurable hard/default timeouts for built-in bash and dbt tool executions
- allow dbt tool invocations to apply PostgreSQL runtime guards via `BEE_PI_AGENT_DBT_PGOPTIONS` / `PGOPTIONS`
- document `PGOPTIONS` for direct database clients launched by the agent

## 0.1.12

- emit only the final assistant answer to the gateway and suppress internal thinking output

## 0.1.11

- add `BEE_PI_AGENT_THINKING_LEVEL` support for configuring model reasoning level, including `medium`
- suppress empty assistant thinking events so downstream consumers only receive non-blank thinking output
- document `BEE_PI_AGENT_THINKING_LEVEL` in the README

## 0.1.8

- rename Helm chart packaging from `charts/bee-pi-agent` to `charts/fabee-pi-agent`
- rename Helm helper namespaces from `bee-pi-agent.*` to `fabee-pi-agent.*`
- add optional `dbtProfiles` secret mount support to the Helm chart for mounting `profiles.yml`
- update README to reference the renamed Helm chart packaging while keeping runtime naming compatibility notes

## 0.1.0-jmm.0

- initial extraction of a generic HTTP-operated worker runtime from `pi-mom`
- removes Slack-specific ingress/response handling
- exposes a run-oriented SSE API for gateway integration
