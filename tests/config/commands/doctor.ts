export const REMOVED_CONFIGURATION_CASES = [
    {
        name: 'removed at the root',
        options: {
            tables: 'removed_configurations = { bash = "Bash is deliberately excluded from this selection." }\n',
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
            tables: 'removed_configurations = { bash = "Bash is deliberately excluded from this selection." }\n',
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
            tables: '[[scope]]\npath = "api"\nremoved_configurations = { bash = "Bash is deliberately excluded from this selection." }\n[[scope]]\npath = "worker"\n',
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
        evidence: 'no files in root yet; remove it if none are planned',
        command: 'gspot remove bash --reason "<why>"',
    },
    {
        configuration: 'python',
        evidence: 'no files in api app yet; remove it if none are planned',
        command: 'gspot remove python --scope \'api app\' --reason "<why>"',
    },
] as const;

export const CI_PREFERENCE_CASES = [
    {
        name: 'a GitHub workflow before a GitLab remote',
        tracked: ['.github/workflows/build.yml'],
        untracked: '',
        remote: 'git@gitlab.com:example/repo.git',
        ci: 'off; gspot set ci.enabled true writes the check workflow',
    },
    {
        name: 'tracked GitLab before GitHub',
        tracked: ['.gitlab-ci.yml', '.github/workflows/build.yml'],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        ci: 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow',
    },
    {
        name: 'GitLab file before GitHub remote',
        tracked: [],
        untracked: '.gitlab-ci.yml',
        remote: 'git@github.com:example/repo.git',
        ci: 'off; gspot set ci.enabled true and gspot set ci.provider gitlab write the check workflow',
    },
    {
        name: 'GitHub remote with unrelated Bitbucket configuration',
        tracked: ['bitbucket-pipelines.yml'],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        ci: 'off; gspot set ci.enabled true writes the check workflow',
    },
    {
        name: 'GitHub SSH remote',
        tracked: [],
        untracked: '',
        remote: 'git@github.com:example/repo.git',
        ci: 'off; gspot set ci.enabled true writes the check workflow',
    },
    {
        name: 'unrecognized remote host',
        tracked: [],
        untracked: '',
        remote: 'https://github.com.example.com/example/repo.git',
        ci: 'none',
    },
] as const;
