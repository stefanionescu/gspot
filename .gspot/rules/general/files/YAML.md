# YAML

Rules for every `.yml` and `.yaml` file.

- Keep one document per file unless the consumer requires a stream.
- Quote strings that YAML otherwise reinterprets: `yes`, `no`, `on`, `off`, `null`, `~`,
  version numbers such as `1.10`, octal-looking values, and anything starting with `*`, `&`, `!`,
  `%`, `@`, or a backtick.
- Keep anchors and aliases inside one file. Name them for what they carry. No merge keys
  across documents.
- Long strings use a block scalar, `|` or `>`, rather than a quoted string with escapes.

## Organization

<!-- level: all -->

- Order keys as the consumer documents, then alphabetically. Do not reorder keys in a file
  you did not otherwise change.
- Use `.yml` for GitHub workflows, `compose.yaml` for Compose, and `.yaml` elsewhere.
