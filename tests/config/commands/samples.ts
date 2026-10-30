export const INHERITED_CONFIGURATION_SETTINGS = `configurations = ["markdown", "bash"]
[rules]
enabled = false
[[scope]]
path = "api"
`;

export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const UNKNOWN_CONFIGURATION_REFUSALS = ['not-a-real-config-a', 'not-a-real-config-b']
    .map(
        (name) =>
            `There is no configuration called ${name}. See https://generativespotting.com/reference/configurations/ for the available configurations.\n`,
    )
    .join('');

export const BASH_CONFIG_FILE_NAMES = ['semgrep.yml', 'shellcheckrc'];

export const SQL_COMMAND_CHECK = { id: 'project/read-sql', paths: ['**/*.sql'], stage: 'commit' };

export const SQL_SEARCH_ARGUMENTS = [
    '--text',
    'CREATE FUNCTION',
    '--report',
    'message',
    '--message',
    'Replace the sample function.',
    '--',
    '{files}',
];

export const TEST_VERSION = '0.0.0-test';

export const API_SCOPE_FILES = { 'README.md': '# Example\n', 'api/entry.sh': 'echo api\n' } as const;
