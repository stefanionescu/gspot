---
title: YAML
---

# YAML

Requirements about vocabulary, architecture, naming, documentation coverage, declaration
order, API style, and complexity apply at `all` or when the project explicitly opts into
them. Correctness, security, accessibility, type safety, routine formatting, and declared
project contracts apply at both levels.

Rules for workflow files, Compose files, configuration such as `config.toml`-adjacent YAML,
and any `.yml` or `.yaml` the repository owns.

- Follow the configured formatter for indentation and line endings. Use spaces instead of tabs
  for indentation. Keep one document per file unless the consumer requires a stream.
- Quote strings that YAML otherwise reinterprets: `yes`, `no`, `on`, `off`, `null`, `~`,
  version numbers such as `1.10`, octal-looking values, and anything starting with `*`, `&`, `!`,
  `%`, `@`, or a backtick.
- Keys are stable and unique. A duplicate key is a finding.
- Anchors and aliases stay inside one file and are named for what they carry. No merge keys
  across documents.
- Long strings use a block scalar (`|` or `>`) rather than a quoted string with escapes.
- No trailing whitespace, one blank line at most between top-level keys, and a final newline.
- Comments explain a value that is not obvious; they never restate the key.
- Secrets never appear in YAML. Reference them through the consumer's secret mechanism.

## Organization

<!-- level: all -->

- Key order is the consumer's documented order, then alphabetical. Do not reorder keys in a file
  you did not otherwise change.
- The file name extension is `.yml` for GitHub workflows and Compose, `.yaml` elsewhere, and one
  extension per repository outside those two.
