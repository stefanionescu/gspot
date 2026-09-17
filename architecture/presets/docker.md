# docker

Kind: tool. Requires: config-files.

## Detects and claims

| | |
| --- | --- |
| Detect | `Dockerfile*`, `*.dockerfile`, `docker-compose*.yml`, `compose*.yml`, `.dockerignore` |
| Claims | the same |
| Required inspections | syntax, style, security, spelling |

## Tools

hadolint, trivy, docker (host).

## Generated configuration

| Target | Stub | Holds |
| --- | --- | --- |
| `.gspot/hadolint.yaml` | `.hadolint.yaml` | `failure-threshold: style`, ignored rules from `[tools.hadolint] ignore` with reasons, trusted registries |
| `.gspot/trivy.yaml` | none | severities, ignore file path, timeout |

## Checks

| Id | Stage | Command |
| --- | --- | --- |
| `docker/hadolint` | commit | `hadolint --config .gspot/hadolint.yaml {files}` (ShellCheck runs over `RUN` lines inside hadolint) |
| `docker/compose-config` | commit | `docker compose -f <file> config --quiet` per compose file (parses without a daemon) |
| `docker/dockerignore` | commit | `.dockerignore` exists beside every Dockerfile and excludes `.git`, `node_modules`, `.gspot` |
| `docker/trivy-config` | push, docker | `trivy config --config .gspot/trivy.yaml <dir>` |
| `docker/trivy-image` | manual, docker, network | `trivy image` over images the compose file names, with `[tools.trivy] ignore` (id, reason) |
| `structure/shell-embeds` | commit | no inline Python or Node heredocs in `RUN` lines |

## Settings

`tools.hadolint.ignore` (rule, reason), `tools.hadolint.trusted_registries`, `tools.trivy.severity`
(default `HIGH,CRITICAL`), `tools.trivy.ignore` (id, reason), `tools.trivy.timeout`.

## Rule files

`tool/docker/DOCKER.md`; `templates/project/DOCKER-ML.md` offered when CUDA base images are detected.

## Not covered here

The compose file itself is a config-files YAML with the Compose schema.
