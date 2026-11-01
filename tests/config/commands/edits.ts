export const FORMAT_SETTINGS = `configurations = ["format"]
[rule_files]
enabled = false
`;

export const PRETTIER_PATH_IGNORE = `
[[ignore]]
check = "format/prettier"
paths = ["**/*.json"]
reason = "These files retain generated formatting."
`;

export const UNSET_REFUSALS = [
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    {
        commandArguments: ['unset', 'no_such_key'],
        message: 'There is no setting called no_such_key.',
    },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list or a table, so it takes no items. Run gspot unset level.',
    },
] as const;

export const UPDATED_AGENTS = 'updated  AGENTS.md';

export const UNKNOWN_IGNORE_ARGUMENTS = [
    'ignore',
    'bash/shelcheck',
    '--reason',
    'The sample check name is misspelled.',
] as const;

export const IGNORE_REFUSALS = [
    {
        name: 'a one-letter reason',
        arguments: ['ignore', '--paths', 'vendor/**', '--reason', 'x'],
        message: 'gspot ignore needs a reason of two or more words that says why: "x" is refused.',
    },
    {
        name: 'ignore without a check or paths',
        arguments: ['ignore', '--reason', 'Vendored sources remain outside the checks.'],
        message: '--paths: An ignore without check needs paths.',
    },
    {
        name: 'ignore with a rule but no check',
        arguments: [
            'ignore',
            '--rule',
            'SC2086',
            '--paths',
            'vendor/**',
            '--reason',
            'Vendored sources remain outside the checks.',
        ],
        message: '--rule: An ignore without check cannot name a rule. Add the check that owns the rule.',
    },
] as const;

export const LITERAL_ROUTE_CASES = [
    {
        folder: 'app/[id]',
        path: 'app/[id]/**',
        escaped: String.raw`app/\[id\]/**`,
    },
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

export const TOOLS_CHANGED_NOTE =
    'The tools changed. Run gspot install; until then gspot/generated-files fails on the tool lockfile.';

export const UNKNOWN_CONFIGURATION_REFUSALS = ['not-a-real-config-a', 'not-a-real-config-b']
    .map(
        (name) =>
            `There is no configuration called ${name}. See https://generativespotting.com/reference/configurations/ for the available configurations.\n`,
    )
    .join('');

export const SET_SETTINGS = `configurations = ["markdown", "structure"]
[rule_files]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;

export const LOOSENED_SETTINGS = [
    {
        key: 'site.allowed_unlisted_pages',
        value: 'account/index.html',
        second: 'admin/index.html',
    } as const,
] as const;

export const SET_REFUSALS = [
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'The value { MD013 = false } is not valid for tools.markdownlint.rules. This table holds options only, without a severity; the level decides which rules run. To turn MD013 off, run gspot ignore markdown/markdownlint --rule MD013 --reason "<why>".',
    ],
    [
        'an undeclared scope',
        ['set', 'limits.max_file_lines', '100', '--scope', 'web'],
        'There is no scope called web. Name a project folder or a written scope.',
    ],
    [
        'an invalid level',
        ['set', 'level', 'everything'],
        'The value everything is not valid for level. Use basic or all.',
    ],
    [
        'an ignore',
        ['set', 'ignore', 'bash/shellcheck'],
        'Use gspot ignore to add an ignore, or gspot unignore to remove one.',
    ],
    [
        'another record list',
        ['set', 'command_check', 'lint'],
        'Write [[command_check]] by hand in gspot.toml. Record lists have their own fields.',
    ],
] as const;

export const KEPT_SETTING_CHANGES = [
    [
        'set',
        ['set', 'limits.bash.max_file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits]\nbash = { max_file_lines = { value = 200, reason = "Generated scripts need this limit." } }',
    ],
] as const;

export const STOPPED_APPLY_FILES = {
    'gspot.toml': `configurations = ["bash", "structure"]
[rule_files]
enabled = false
`,
    'entry.sh': 'echo example\n',
} as const;

export const UNKNOWN_SETTING_KEYS = [
    {
        key: 'tools.eslint.unknown_key',
        message: 'There is no setting called tools.eslint.unknown_key. No setting exists under that table.',
    },
    {
        key: 'data_files.unknown_key',
        message:
            'There is no setting called data_files.unknown_key. The settings that exist under that table are schemas.',
    },
] as const;

export const STRING_SETTING_VALUES = [
    { key: 'naming.banned_words', words: ['2024'], value: ['2024'] },
    { key: 'naming.banned_words', words: ['true'], value: ['true'] },
    { key: 'ci.linux_runner', words: ['true'], value: 'true' },
    { key: 'ci.setup_command', words: ['make', '2'], value: ['make', '2'] },
] as const;

export const SET_VALUE_REFUSALS = [
    {
        name: 'set with malformed TOML',
        arguments: ['set', 'ci.setup_command', '['],
        message:
            'The value [ is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.',
    },
    {
        name: 'set without an existing list reason',
        arguments: ['set', 'site.allowed_unlisted_pages', 'admin/index.html'],
        message:
            'site.allowed_unlisted_pages already has the reason "The private page belongs outside the public site map.". Pass --reason with a reason that covers every item.',
    },
    {
        name: 'set with an unnecessary reason',
        arguments: ['set', 'spelling.locale', 'en-gb', '--reason', 'The project publishes content for local readers.'],
        message:
            'spelling.locale takes no reason here: the value does not loosen the shipped default. Run the command without --reason.',
    },
] as const;

const COMMAND_VALUE_SETTINGS = `configurations = ["site"]
[rule_files]
enabled = false
[site]
allowed_unlisted_pages = { value = ["private/index.html"], reason = "The private page belongs outside the public site map." }
`;

export const REFUSAL_FILES = { 'gspot.toml': COMMAND_VALUE_SETTINGS, 'control.txt': 'preserve\n' } as const;

export const VALUE_VALIDATION_CASES = [
    { name: 'without a reason', hasReason: false },
    { name: 'with a reason', hasReason: true },
] as const;

export const CONFIGURATIONS_SETTINGS = 'configurations = []\n';

export const SITE_PACKAGE_MANAGER_CASES = [
    ['npm fallback', {}, 'npm'],
    ['declared Bun', { 'package.json': '{"packageManager":"bun@1.4.2"}' }, 'bun'],
] as const;
