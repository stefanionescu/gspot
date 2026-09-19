# `nginx`

Kind: tool. Requires: nothing.

## Detects and claims

|                      |                                                        |
| -------------------- | ------------------------------------------------------ |
| Detect               | `nginx.conf`, `*.conf` under a directory named `nginx` |
| Claims               | the same                                               |
| Required inspections | syntax, security                                       |

## Tools

gixy, docker (host) for `nginx -t`.

## Checks

| Id                  | Stage        | Command                                                                                   |
| ------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `nginx/gixy`        | commit       | `gixy --format json <file>` (the `gixy-ng` package; the original reads no current Python) |
| `nginx/config-test` | push, docker | `docker run --rm` of `tools.nginx.image` with the file mounted, then `nginx -t`           |

The check reads each `nginx.conf`. Every `ssl_certificate` and `ssl_certificate_key` path gets a
throwaway self-signed pair mounted at that path. The pair lives in a temporary directory that the check removes. Every upstream and `proxy_pass` host name resolves to `127.0.0.1` through `--add-host`.
Nothing comes from a Compose file, so a repository with no Compose file runs the same test.

## Settings

`tools.nginx.image` (default `nginx:stable-alpine`); a gixy check turned off is `gspot ignore nginx/gixy --rule <check> --reason`.

## Rule files

`tool/nginx/NGINX.md`.
