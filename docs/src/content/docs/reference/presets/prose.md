---
title: "Prose"
description: "Vale over every comment and every documentation file, with the gspot style, and the upstream packages."
---

Vale over every comment and every documentation file, with the gspot style, and the upstream packages.

Kind: repository. Requires: `markdown`.

## Tools

- vale 3.21.0

## Generated configuration

- `.gspot/vale.ini`

## Checks

| Check                                                      | Stage  | What it finds                                                                                                                                |
| ---------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`prose/vale`](/reference/rules/prose/vale/)               | commit | Runs Vale over comments, and documentation with the gspot style, and the upstream packages; every alert is a finding.                        |
| [`prose/source-bans`](/reference/rules/prose/source-bans/) | commit | Finds Vale directives inside Markdown and block comments in SQL, which take text away from the prose check.                                  |
| [`prose/messages`](/reference/rules/prose/messages/)       | commit | Checks the strings Vale cannot see: error messages start with a capital letter, client messages name no identifier, log messages are stable. |
| [`prose/doc-tags`](/reference/rules/prose/doc-tags/)       | commit | Checks that doc comments carry no types, which the language already states.                                                                  |

## Settings

- `prose.vocabulary`: Names Vale accepts as written: products, tools, people.
- `prose.disabled`: Vale rules this repository turns off, each with a reason.

## Rule files

- `general/prose/WRITING.md`
- `general/code/COMMENTS.md`
