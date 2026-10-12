export const DEFAULT_CASES = [
    {
        name: `defaults are omitted`,
        source: `level="recommended"
removed_configurations=[]
tool_timeout_seconds=600
[hooks]
enabled=false
[format]
indent_style="space"
indent_width=4
`,
        expected: `#:schema https://unpkg.com/@gspothq/cli@0.1.0/gspot.schema.json


`,
    },
    {
        name: `scope restores default after parent override`,
        source: `[format]
indent_width=2
[[scope]]
path="app"
format.indent_width=4
[[scope]]
path="app/worker"
format.indent_width=4
[[scope]]
path="notes"
format.indent_width=2
`,
        expected: `#:schema https://unpkg.com/@gspothq/cli@0.1.0/gspot.schema.json

[format]
indent_width = 2

[[scope]]
path = "app"
format.indent_width = 4

[[scope]]
path = "app/worker"

[[scope]]
path = "notes"
`,
    },
    {
        name: `language default restores root limit`,
        source: `[limits]
file_lines={value=500,reason="Reviewed root files need this ceiling."}
[[scope]]
path="app"
limits.python.file_lines=300
[[scope]]
path="app/worker"
limits.python.file_lines=300
`,
        expected: `#:schema https://unpkg.com/@gspothq/cli@0.1.0/gspot.schema.json

[limits]
file_lines = { value = 500, reason = "Reviewed root files need this ceiling." }

[[scope]]
path = "app"
limits.python.file_lines = 300

[[scope]]
path = "app/worker"
`,
    },
] as const;
