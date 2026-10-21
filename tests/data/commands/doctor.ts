import { buildSandboxSettings } from '#tests/setup/settings.ts';

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
