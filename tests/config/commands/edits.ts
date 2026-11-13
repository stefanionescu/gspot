// edit refusals
const COMMAND_VALUE_SETTINGS = `configurations = ["site"]
[rule_files]
enabled = false
[site]
allowed_unlisted_pages = { value = ["private/index.html"], reason = "The private page belongs outside the public site map." }
`;
export const REFUSAL_FILES = { 'gspot.toml': COMMAND_VALUE_SETTINGS, 'control.txt': 'preserve\n' } as const;

// scope inheritance
export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rule_files]
enabled = false
[[scope]]
path = "api"
`;

// scope removals
export const EXCLUDED_CONFIGURATION_SETTINGS = `configurations = ["typescript"]
[rule_files]
enabled = false
[[scope]]
path = "api"
removed_configurations = { typescript = "The API scope uses Bash without the inherited TypeScript tools." }
`;
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

// set values
export const ROOT_EDITORCONFIG = 'root = true\n';
export const STRING_SETTING_VALUES = [
    { key: 'naming.banned_words', words: ['2024'], value: ['2024'] },
    { key: 'ci.linux_runner', words: ['true'], value: 'true' },
] as const;
