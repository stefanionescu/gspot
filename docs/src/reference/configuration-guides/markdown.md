# Markdown Configuration

## Markdown rule options

Markdown rule settings hold tool option tables, without an enable/disable value or a `default` key:

```toml
[tools.markdownlint.rules]
MD024 = { siblings_only = false }
```

This reports repeated headings throughout a document, rather than only under the same parent heading.
The selected level decides which rules run. Options cannot enable a rule outside that level.
Both levels check image alt text. Accept a specific finding with `gspot ignore markdown/markdownlint --rule <rule> --reason "<why>"`.
