export const REMOVED_CONFIGURATION_SUGGESTIONS = [
    {
        name: 'removed at the root',
        options: {
            tables: 'removed_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n',
        },
        files: {
            'entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'all Bash evidence is in a scope that removed Bash',
        options: {
            scopes: [{ path: 'api' }],
            tables: 'removed_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n',
        },
        files: {
            'api/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'an unaffected sibling supplies Bash evidence',
        options: {
            tables: '[[scope]]\npath = "api"\nremoved_configurations = { value = ["bash"], reason = "Bash is deliberately excluded from this selection." }\n[[scope]]\npath = "worker"\n',
        },
        files: {
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
        evidence: 'no detection evidence in root; remove it if you no longer need it',
        command: 'gspot remove bash --reason "<why>"',
    },
    {
        configuration: 'python',
        evidence: 'no detection evidence in api app; remove it if you no longer need it',
        command: 'gspot remove python --scope \'api app\' --reason "<why>"',
    },
] as const;
