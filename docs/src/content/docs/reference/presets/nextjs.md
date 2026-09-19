---
title: "Next.js"
description: "A Next.js app: the framework and hooks rules of ESLint, and server code marked as server only. Route segments serve one thing, the configuration turns no build check off, and message files parse."
---

A Next.js app: the framework and hooks rules of ESLint, and server code marked as server only. Route segments serve one thing, the configuration turns no build check off, and message files parse.

Kind: framework. Requires: `typescript`.

## Tools

- @next/eslint-plugin-next 15.5.4
- eslint-plugin-react-hooks 6.1.1
- eslint-plugin-react 7.37.5

## Generated configuration

- `.gspot/eslint.config.mjs`

## Checks

| Check                                                                                | Stage  | What it finds                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`integrity/route-segments`](/reference/rules/integrity/route-segments/)             | commit | Checks that no route segment holds both a page and a route handler.                                                                                           |
| [`integrity/next-config`](/reference/rules/integrity/next-config/)                   | commit | Checks that the framework configuration turns no build check off and puts no secret into the client environment.                                              |
| [`integrity/dependency-alignment`](/reference/rules/integrity/dependency-alignment/) | commit | Checks that packages that ship together sit on one version: the framework with its lint package, and react with react-dom.                                    |
| [`integrity/locales`](/reference/rules/integrity/locales/)                           | push   | Checks the message files under tools.next.translations: each message parses, none is empty, no key holds a dot, and every locale holds every key of the base. |

## Settings

- `tools.next.translations`: Where the message files live and which locale is the base: directory and base.

## Rule files

- `framework/nextjs/NEXTJS.md`
- `framework/react/REACT.md`
