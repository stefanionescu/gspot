export const LIST_SCOPE_SETTINGS = `level = "all"
configurations = ["bash", "format", "dependencies"]
test_files = ["checks/**"]
[limits]
file_lines = 250
[format]
indent_width = 4
[dependencies]
min_release_age_days = 14
allowed_registries = { value = ["registry.npmjs.org", "registry.example.com"], reason = "The repository resolves packages through both registries." }
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
limits.file_lines = 200
format.indent_width = 2
[[scope]]
path = "api/worker"
configurations = ["sql"]
limits.sql.file_lines = 30
tools.sqlfluff.dialect = "postgres"
`;

export const LIST_SCOPE_ROWS = [
    'dependencies.allowed_registries          ["registry.npmjs.org","regi… adding              gspot.toml',
    'dependencies.min_release_age_days        14                           lowering            gspot.toml',
    'limits.file_lines                        250                          raising             gspot.toml',
    'test_files                               ["checks/**"]                                    gspot.toml',
    'limits.file_lines                        200                          raising             [scope "api"]  [scope api]',
] as const;

export const SHFMT_IGNORE_SETTINGS = {
    tables: `[[ignore]]
check = "bash/shfmt"
reason = "Review this separately."
`,
} as const;
