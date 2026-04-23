# Changelog

## 0.1.8

- rename Helm chart packaging from `charts/bee-pi-agent` to `charts/fabee-pi-agent`
- rename Helm helper namespaces from `bee-pi-agent.*` to `fabee-pi-agent.*`
- add optional `dbtProfiles` secret mount support to the Helm chart for mounting `profiles.yml`
- update README to reference the renamed Helm chart packaging while keeping runtime naming compatibility notes

## 0.1.0-jmm.0

- initial extraction of a generic HTTP-operated worker runtime from `pi-mom`
- removes Slack-specific ingress/response handling
- exposes a run-oriented SSE API for gateway integration
