export const FORMAT_SETTINGS = `configurations = ["format"]
[rules]
enabled = false
`;

export const PRETTIER_PATH_IGNORE = `
[[ignore]]
check = "format/prettier"
paths = ["**/*.json"]
reason = "These files retain generated formatting."
`;
