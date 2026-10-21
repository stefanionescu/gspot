export const REMOVED_CONFIGURATION_SUGGESTIONS = [
    {
        name: 'removed at the root',
        project: {
            'gspot.toml': `configurations = []
removed_configurations = ["bash"]
`,
            'entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'all Bash evidence is in a scope that removed Bash',
        project: {
            'gspot.toml': `configurations = []
[[scope]]
path = "api"
removed_configurations = ["bash"]
`,
            'api/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [],
    },
    {
        name: 'an unaffected sibling supplies Bash evidence',
        project: {
            'gspot.toml': `configurations = []
[[scope]]
path = "api"
removed_configurations = ["bash"]
[[scope]]
path = "worker"
`,
            'api/entry.sh': 'echo ready\n',
            'worker/entry.sh': 'echo ready\n',
            'source.py': 'print("ready")\n',
        },
        expected: [{ configuration: 'bash', evidence: '1 .sh file', command: 'gspot add bash' }],
    },
] as const;
