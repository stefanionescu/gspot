---
title: "tRPC"
description: "tRPC routers: every procedure validates its input, and client code imports the router as a type only."
---

tRPC routers: every procedure validates its input, and client code imports the router as a type only.

Kind: library. Requires: `javascript`.

## Checks

| Check                                                                | Stage  | What it finds                                                               |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| [`trpc/router-boundaries`](/reference/rules/trpc/router-boundaries/) | commit | Checks that code outside the server paths imports from them as a type only. |

## Settings

- `tools.trpc.server_paths`: The paths that hold the routers and everything they import.

## Rule files

- `library/trpc/TRPC.md`
