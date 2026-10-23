export const SET_SETTINGS = `configurations = ["markdown", "structure"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;

/** The root and a child scope, where set writes banned words. */
/** Settings with one scope in the layout that set and unset write. */
export const BANNED_WORD_SETTINGS = `#:schema ./.gspot/gspot.schema.json
configurations = ["naming", "typescript"]

[rules]
enabled = false

[[scope]]
path = "app"
`;

export const BANNED_WORD_SCOPES = [
    {
        name: 'root',
        scope: '',
        written: `#:schema ./.gspot/gspot.schema.json
configurations = ["naming", "typescript"]

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
        written: `#:schema ./.gspot/gspot.schema.json
configurations = ["naming", "typescript"]

[rules]
enabled = false

[[scope]]
path = "app"
naming.banned_words = ["discardedword"]
`,
    },
] as const;

/** List settings that loosen a check; each needs a reason, and set and unset edit them the same way. */
export const LOOSENED_SETTINGS = [
    {
        key: 'site.allowed_unlisted_pages',
        value: 'account/index.html',
        second: 'admin/index.html',
        defaults: ['dist/404.html'],
        appDefaults: ['app/dist/404.html'],
        siblingDefaults: ['sibling/dist/404.html'],
    } as const,
    {
        key: 'dependencies.allowed_registries',
        value: 'registry.example.test',
        second: 'packages.example.test',
        defaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
        appDefaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
        siblingDefaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
    } as const,
] as const;

/** The records of the restricted_imports value below. */
export const RESTRICTED_IMPORT_RECORDS = [
    { name: 'unreviewed-module', message: 'Import the reviewed entrypoint for this dependency.' },
] as const;

/** One restricted import as a TOML inline value. */
export const RESTRICTED_IMPORTS = `[{name = "unreviewed-module", message = "Import the reviewed entrypoint for this dependency."}]`;

export const SETTING_REASON = 'The project contract requires this reviewed exception.';

/** The banned word written by the set command tests. */
export const SCOPE_BANNED_WORDS = ['discardedword'] as const;

/** Each set command that exits 2, with the message that names the fix. */
export const SET_REFUSALS = [
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'gspot.toml: tools.markdownlint.rules.MD013: This table holds options only, without a severity; the level decides which rules run. To turn MD013 off, run gspot ignore markdown/markdownlint --rule MD013 --reason "<why>".',
    ],
    ['a key without a value', ['set', 'limits.file_lines'], "Missing required argument 'values'"],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'gspot.toml has no [[scope]] with path = "web". Add one, or leave out --scope.',
    ],
    [
        'an invalid level',
        ['set', 'level', 'everything'],
        'The value everything is not valid for level. Use recommended or all.',
    ],
    ['an ignore', ['set', 'ignore', 'bash/shellcheck'], 'Run gspot ignore <check> --reason "<why>" to add an ignore.'],
    [
        'another record list',
        ['set', 'command_check', 'lint'],
        'Write [[command_check]] by hand in gspot.toml. Record lists have their own fields.',
    ],
] as const;

/** A set and an ignore whose change gspot.toml keeps when the apply after it stops. Each row holds the text it writes and the line it prints. */
export const KEPT_SETTING_CHANGES = [
    [
        'set',
        ['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits.bash]\nfile_lines = { value = 200, reason = "Generated scripts need this limit." }',
        'Set limits.bash.file_lines to 200.  # Generated scripts need this limit.  (was 140 from configuration structure)',
    ],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
        'Ignored bash/shellcheck for entry.sh.',
    ],
] as const;

/** A sandbox whose apply stops after a set or an ignore. */
export const STOPPED_APPLY_FILES = {
    'gspot.toml': `configurations = ["bash", "structure"]
[rules]
enabled = false
`,
    'entry.sh': 'echo example\n',
} as const;

/** Commands that leave gspot.toml with the value it already has. */
export const NO_CHANGE_COMMANDS = [
    ['unset level', ['unset', 'level']],
    ['set level recommended', ['set', 'level', 'recommended']],
] as const;

/** Keys that set refuses, with the start of each message. */
export const UNKNOWN_SETTING_KEYS = [
    {
        key: 'tools.eslint.extra',
        message: 'No selected configuration has the setting tools.eslint.extra. No setting exists under that table.',
    },
    {
        key: 'tools.v8r.extra',
        message:
            'No selected configuration has the setting tools.v8r.extra. The settings that exist under that table are `schema`.',
    },
] as const;
