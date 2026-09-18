# nginx

Kind: tool. Requires: docker when the configuration runs in a container.

## Detects and claims

|                      |                                                        |
| -------------------- | ------------------------------------------------------ |
| Detect               | `nginx.conf`, `*.conf` under a directory named `nginx` |
| Claims               | the same                                               |
| Required inspections | syntax, security                                       |

## Tools

gixy, docker (host) for `nginx -t`.

## Checks

| Id                  | Stage        | Command                                                                                                                                                  |
| ------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nginx/gixy`        | commit       | `gixy <file>`                                                                                                                                            |
| `nginx/config-test` | push, docker | `docker compose -f <compose> run --rm --no-deps <service> nginx -t`; the image, network aliases and volumes come from the compose file, never from gspot |

The service name comes from `[tools.nginx] compose_service`; when unset, the first service whose
image starts with `nginx`. A throwaway self-signed certificate is generated into a temporary
directory for the test and removed after.

## Settings

`tools.nginx.compose_file`, `tools.nginx.compose_service`, a gixy check turned off is `gspot ignore nginx/gixy --rule <check> --reason`.

## Rule files

`tool/nginx/NGINX.md`.
