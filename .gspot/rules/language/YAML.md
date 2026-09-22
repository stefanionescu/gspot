---
layer: language
preset: configs
title: YAML
---

# YAML

Rules for workflow files, Compose files, configuration such as `config.toml`-adjacent YAML,
and any `.yml` or `.yaml` the repository owns.

- Two-space indentation, no tabs, LF line endings, one document per file unless the consumer
  requires a stream.
- Quote strings that YAML otherwise reinterprets: `yes`, `no`, `on`, `off`, `null`, `~`,
  version numbers such as `1.10`, octal-looking values, and anything starting with `*`, `&`, `!`,
  `%`, `@`, or a backtick.
- Keys are stable and unique. A duplicate key is a finding.
- Key order is the consumer's documented order, then alphabetical. Do not reorder keys in a file
  you did not otherwise change.
- Anchors and aliases stay inside one file and are named for what they carry. No merge keys
  across documents.
- Long strings use a block scalar (`|` or `>`) rather than a quoted string with escapes.
- No trailing whitespace, one blank line at most between top-level keys, and a final newline.
- Comments explain a value that is not obvious; they never restate the key.
- Secrets never appear in YAML. Reference them through the consumer's secret mechanism.
- The file name extension is `.yml` for GitHub workflows and Compose, `.yaml` elsewhere, and one
  extension per repository outside those two.
