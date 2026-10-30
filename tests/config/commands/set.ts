export const SET_SETTINGS = `configurations = ["markdown", "structure"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;

export const BANNED_WORD_SETTINGS = `configurations = ["naming", "typescript"]

[rules]
enabled = false

[[scope]]
path = "app"
`;

export const BANNED_WORD_SCOPES = [
    {
        name: 'root',
        scope: '',
        written: `configurations = ["naming", "typescript"]

[rules]
enabled = false

[naming]
banned_words = ["discardedword"]

[[scope]]
path = "app"
`,
    },
    {
        name: 'child',
        scope: 'app',
        written: `configurations = ["naming", "typescript"]

[rules]
enabled = false

[[scope]]
path = "app"
naming = { banned_words = ["discardedword"] }
`,
    },
] as const;

export const LOOSENED_SETTINGS = [
    {
        key: 'site.allowed_unlisted_pages',
        value: 'account/index.html',
        second: 'admin/index.html',
    } as const,
    {
        key: 'dependencies.allowed_registries',
        value: 'registry.example.test',
        second: 'packages.example.test',
    } as const,
] as const;

export const SETTING_REASON = 'The project contract requires this reviewed exception.';

export const SET_REFUSALS = [
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'The value { MD013 = false } is not valid for tools.markdownlint.rules. This table holds options only, without a severity; the level decides which rules run. To turn MD013 off, run gspot ignore markdown/markdownlint --rule MD013 --reason "<why>".',
    ],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'There is no project scope web. Name a project folder or a written scope.',
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
        ['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits]\nbash = { file_lines = { value = 200, reason = "Generated scripts need this limit." } }',
        'Set limits.bash.file_lines to 200.  # Generated scripts need this limit.  (was 140 from configuration structure)\nnote     No selected check reads limits.bash.file_lines at level basic.',
    ],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
        'Ignored bash/shellcheck for entry.sh.',
    ],
] as const;

export const STOPPED_APPLY_FILES = {
    'gspot.toml': `configurations = ["bash", "structure"]
[rules]
enabled = false
`,
    'entry.sh': 'echo example\n',
} as const;

export const NO_CHANGE_COMMANDS = [
    ['unset level', ['unset', 'level']],
    ['set level basic', ['set', 'level', 'basic']],
] as const;

export const UNKNOWN_SETTING_KEYS = [
    {
        key: 'tools.eslint.unknown_key',
        message:
            'No selected configuration has the setting tools.eslint.unknown_key. No setting exists under that table.',
    },
    {
        key: 'tools.v8r.unknown_key',
        message:
            'No selected configuration has the setting tools.v8r.unknown_key. The settings that exist under that table are schema.',
    },
] as const;

export const STRING_SETTING_VALUES = [
    { key: 'naming.banned_words', words: ['2024'], value: ['2024'] },
    { key: 'naming.banned_words', words: ['true'], value: ['true'] },
    { key: 'naming.banned_words', words: ['false'], value: ['false'] },
    { key: 'ci.linux_runner', words: ['2204'], value: '2204' },
    { key: 'ci.linux_runner', words: ['true'], value: 'true' },
    { key: 'ci.setup_command', words: ['make', '2'], value: ['make', '2'] },
    { key: 'ci.setup_command', words: ['false'], value: ['false'] },
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
[rules]
enabled = false
[site]
allowed_unlisted_pages = { value = ["private/index.html"], reason = "The private page belongs outside the public site map." }
`;

export const REFUSAL_FILES = { 'gspot.toml': COMMAND_VALUE_SETTINGS, 'control.txt': 'preserve\n' } as const;

export const VALUE_VALIDATION_CASES = [
    { name: 'without a reason', hasReason: false },
    { name: 'with a reason', hasReason: true },
] as const;
