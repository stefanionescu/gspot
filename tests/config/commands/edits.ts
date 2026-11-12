export const ROOT_EDITORCONFIG = 'root = true\n';

export const UNKNOWN_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shelcheck',
    '--reason',
    'The sample check name is misspelled.',
] as const;

const PARENT_CONFIGURATION_SETTINGS = `configurations = ["markdown"]
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
[[scope]]
path = "api/child"
configurations = ["python"]
`;

export const PARENT_REQUIREMENT_SETTINGS = `configurations = ["markdown"]
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["typescript"]
[[scope]]
path = "api/child"
configurations = ["bash"]
`;

export const EXCLUDED_CONFIGURATION_SETTINGS = `configurations = ["typescript"]
[rule_files]
enabled = false
[[scope]]
path = "api"
removed_configurations = { typescript = "The API scope uses Bash without the inherited TypeScript tools." }
`;

export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rule_files]
enabled = false
[[scope]]
path = "api"
`;

export const SCOPE_REMOVALS = [
    {
        name: 'a scope that inherits bash records the removal in the scope',
        settings: INHERITED_CONFIGURATION_SETTINGS,
        files: { 'api/entry.sh': 'echo api\n' },
        scope: 'api',
        expected: {
            configurations: ['markdown', 'bash'],
            scopes: { api: { configurations: [], removed_configurations: ['bash'] } },
        },
    },
    {
        name: 'a child drops a parent configuration and keeps its own configuration and ancestors',
        settings: PARENT_CONFIGURATION_SETTINGS,
        files: { 'api/entry.sh': 'echo api\n', 'api/child/entry.py': 'value = 1\n' },
        scope: 'api/child',
        expected: {
            configurations: ['markdown'],
            scopes: {
                api: { configurations: ['bash'], removed_configurations: [] },
                'api/child': { configurations: ['python'], removed_configurations: ['bash'] },
            },
        },
    },
] as const;

export const API_LANGUAGE_REASON = 'The API uses another language.';

export const STOPPED_APPLY_FILES = {
    'gspot.toml': `configurations = ["bash", "structure"]
[rule_files]
enabled = false
`,
    'entry.sh': 'echo example\n',
} as const;

export const STRING_SETTING_VALUES = [
    { key: 'naming.banned_words', words: ['2024'], value: ['2024'] },
    { key: 'ci.linux_runner', words: ['true'], value: 'true' },
] as const;

const COMMAND_VALUE_SETTINGS = `configurations = ["site"]
[rule_files]
enabled = false
[site]
allowed_unlisted_pages = { value = ["private/index.html"], reason = "The private page belongs outside the public site map." }
`;

export const REFUSAL_FILES = { 'gspot.toml': COMMAND_VALUE_SETTINGS, 'control.txt': 'preserve\n' } as const;
