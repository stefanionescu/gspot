export const OUTDATED_TOOL_PROJECTS = [
    { name: 'an edited mise.toml', path: '.gspot/mise.toml', text: '[tools]\n' },
] as const;

export const FAILED_NPM_VERSION = {
    code: 7,
    missing: false,
    duration: 0,
    stdout: '',
    stderr: 'version lookup failed',
} as const;

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

export const OFF_BY_IGNORE = 'off (ignore)';

export const UPDATED_GITATTRIBUTES = 'updated  .gitattributes';

export const TOOLS_CHANGED_LINE =
    'note     The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const UNSET_REFUSALS = [
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    {
        commandArguments: ['unset', 'no_such_key'],
        message:
            'There is no setting called no_such_key in the selected configurations. The settings that exist at the top level are level, tool_timeout_seconds, test_files, hooks, ci, rules, tools, dependencies and 10 more. Run gspot list settings to see every one.',
    },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list or a table, so it takes no items. Run gspot unset level.',
    },
] as const;
