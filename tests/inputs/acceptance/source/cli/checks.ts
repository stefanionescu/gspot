// The literal values acceptance/source/cli/checks reads: names, patterns, limits, and tables.

export const ENTRY = String.raw`
[[check]]
name = "notes/no-fixme"
command = ["grep", "-n", "-H", "FIXME", "{files}"]
paths = ["notes/**"]
stage = "commit"
count_regex = "FIXME"
summary = "Finds FIXME notes left in the notes folder."

[check.output]
format = "regex"
pattern = "^(?<file>[^:]+):(?<line>\\d+):(?<message>.*)$"
`;
