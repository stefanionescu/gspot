---
title: "Ruby"
description: "Ruby source and gems: RuboCop with every new cop on and the complexity ceilings of the other languages, and bundler-audit over Gemfile.lock."
---

Ruby source and gems: RuboCop with every new cop on and the complexity ceilings of the other languages, and bundler-audit over Gemfile.lock.

Kind: language. Requires: `structure`, `formatting`.

## Tools

- ruby
- rubocop 1.91.0
- bundler-audit 0.9.3

## Generated configuration

- `.gspot/rubocop.yml`

## Checks

| Check                                                        | Stage  | What it finds                                                                                                |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| [`ruby/rubocop`](/reference/rules/ruby/rubocop/)             | commit | Runs RuboCop with every cop on, the new ones included, and the complexity ceilings the other languages hold. |
| [`ruby/bundler-audit`](/reference/rules/ruby/bundler-audit/) | push   | Checks Gemfile.lock against the Ruby advisory database, and the Gemfile for a source over plain HTTP.        |

## Rule files

- `language/RUBY.md`
