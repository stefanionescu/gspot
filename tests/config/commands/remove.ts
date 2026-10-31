import { INHERITED_CONFIGURATION_SETTINGS } from '#tests/config/commands/samples.ts';

const PARENT_CONFIGURATION_SETTINGS = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
[[scope]]
path = "api/child"
configurations = ["python"]
`;

export const PARENT_REQUIREMENT_SETTINGS = `configurations = ["markdown"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["typescript"]
[[scope]]
path = "api/child"
configurations = ["bash"]
`;

export const EXCLUDED_CONFIGURATION_SETTINGS = `configurations = ["typescript"]
[rules]
enabled = false
[[scope]]
path = "api"
removed_configurations = { typescript = "The API scope uses Bash without the inherited TypeScript tools." }
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
