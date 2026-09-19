---
title: "Next.js"
description: "A Next.js app: the framework and hooks rules of ESLint, and server code marked as server only. Route segments serve one thing, the configuration turns no build check off, and message files parse."
---

A Next.js app: the framework and hooks rules of ESLint, and server code marked as server only. Route segments serve one thing, the configuration turns no build check off, and message files parse.

Kind: framework. Requires: `typescript`, `react`.

## Tools

- @next/eslint-plugin-next 16.3.5

## Generated configuration

- `.gspot/eslint.config.mjs`

## Checks

| Check                                                                                | Stage  | What it finds                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`nextjs/typecheck`](/reference/rules/nextjs/typecheck/)                             | commit | Has Next.js write its types, then type-checks the app with the strict compiler options.                                                                       |
| [`nextjs/build`](/reference/rules/nextjs/build/)                                     | push   | Builds the app with next build, for a repository that set tools.next.build_in_gate.                                                                           |
| [`integrity/route-segments`](/reference/rules/integrity/route-segments/)             | commit | Checks that no route segment holds both a page and a route handler.                                                                                           |
| [`integrity/next-config`](/reference/rules/integrity/next-config/)                   | commit | Checks that the framework configuration turns no build check off and puts no secret into the client environment.                                              |
| [`integrity/dependency-alignment`](/reference/rules/integrity/dependency-alignment/) | commit | Checks that packages that ship together sit on one version: the framework with its lint package, and react with react-dom.                                    |
| [`integrity/locales`](/reference/rules/integrity/locales/)                           | push   | Checks the message files under tools.next.translations: each message parses, none is empty, no key holds a dot, and every locale holds every key of the base. |

## Settings

- `tools.next.build_in_gate`: Whether the push stage builds the app with next build.
- `tools.next.build_flags`: The flags next build runs with, such as --webpack for an app that does not build with Turbopack.
- `tools.next.translations`: Where the message files live and which locale is the base: directory and base.

## Rule files

- `framework/nextjs/NEXTJS.md`
