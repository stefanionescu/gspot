---
title: "Cloudflare"
description: "Cloudflare Pages and Workers: a wrangler configuration that parses and pins its date, headers and redirects files Cloudflare can read, fresh binding types, and the Semgrep rules for workers."
---

Cloudflare Pages and Workers: a wrangler configuration that parses and pins its date, headers and redirects files Cloudflare can read, fresh binding types, and the Semgrep rules for workers.

Kind: platform. Requires: `javascript`.

## Tools

- wrangler

## Generated configuration

- `.gspot/semgrep/workers.yml` when the [security preset](/reference/presets/security/) is selected

## Checks

| Check                                                                          | Stage  | What it finds                                                                                     |
| ------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------- |
| [`cloudflare/wrangler-config`](/reference/rules/cloudflare/wrangler-config/)   | commit | Checks that every wrangler configuration parses, names the worker, and pins a compatibility date. |
| [`cloudflare/headers-syntax`](/reference/rules/cloudflare/headers-syntax/)     | commit | Checks that the headers file is blocks of a path line and indented header lines.                  |
| [`cloudflare/redirects-syntax`](/reference/rules/cloudflare/redirects-syntax/) | commit | Checks that every redirect is a source, a destination, and an optional status Cloudflare knows.   |
| [`cloudflare/env-types-fresh`](/reference/rules/cloudflare/env-types-fresh/)   | push   | Checks that a tracked environment types file matches what wrangler writes.                        |

## Rule files

- `runtime/workers/WORKERS.md`
