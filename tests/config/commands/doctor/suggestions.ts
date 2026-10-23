import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const STYLELINT_SUGGESTIONS = [
    {
        path: 'app/child/package.json',
        note: 'beside the generated stylelint config file; move any stylelint setting you still need into gspot.toml, then delete the section',
    },
    {
        path: 'other/package.json',
        note: 'beside the generated stylelint config file; move any stylelint setting you still need into gspot.toml, then delete the section',
    },
] as const;

export const REMOVED_CONFIGURATION_SUGGESTIONS = [
    {
        name: 'removed at the root',
        project: {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: 'removed_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n',
            }),
            'entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'all Bash evidence is in a scope that removed Bash',
        project: {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                scopes: [{ path: 'api' }],
                tables: 'removed_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n',
            }),
            'api/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'an unaffected sibling supplies Bash evidence',
        project: {
            'gspot.toml': buildSandboxSettings([], {
                rules: true,
                tables: '[[scope]]\npath = "api"\nremoved_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n[[scope]]\npath = "worker"\n',
            }),
            'api/entry.sh': 'echo ready\n',
            'worker/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [{ configuration: 'bash', evidence: '1 .sh file', command: 'gspot add bash' }],
    },
] as const;

export const REMOVE_SUGGESTIONS = [
    {
        configuration: 'bash',
        evidence: 'no detection evidence in root',
        command: 'gspot remove bash (if you no longer need it)',
    },
    {
        configuration: 'python',
        evidence: 'no detection evidence in api app',
        command: "gspot remove python --scope 'api app' (if you no longer need it)",
    },
] as const;
