const SET_SETTINGS = `configurations = ["markdown", "structure"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;

/** The root and a child scope, where set writes extra Taplo options. */
const EXTRA_OPTION_SCOPES = [
    { name: 'root', scope: '', source: 'gspot.toml' },
    { name: 'child', scope: 'app', source: '[scope "app"]' },
] as const;

/** Project names shared by settings exceptions and generated Vale words. */
const PROJECT_WORDS = ['NebulaConfiguration', 'OrbitalLedger'] as const;

/** List settings that loosen a check; each needs a reason, and set and unset edit them the same way. */
const LOOSENED_SETTINGS = [
    {
        key: 'site.allowed_unlisted_pages',
        value: 'account/index.html',
        second: 'admin/index.html',
        defaults: ['dist/404.html'],
    } as const,
    {
        key: 'dependencies.allowed_registries',
        value: 'registry.example.test',
        second: 'packages.example.test',
        defaults: ['registry.npmjs.org', 'registry.yarnpkg.com'],
    } as const,
    { key: 'allowed_words', value: PROJECT_WORDS[0], second: PROJECT_WORDS[1], defaults: [] } as const,
] as const;

const TWO_SCOPES = `[rules]
enabled = false
[[scope]]
path = "app"
[[scope]]
path = "sibling"
`;

const RESTRICTED_IMPORTS = `[{name = "unreviewed-module", message = "Import the reviewed entrypoint for this dependency."}]`;

const SETTING_REASON = 'The project contract requires this reviewed exception.';

/** Taplo options for the set and explain command tests. */
const TAPLO_OPTIONS = { compact_inline_tables: true } as const;

const TAPLO_REASON = 'The project uses compact inline tables in TOML.';

export {
    TWO_SCOPES,
    SET_SETTINGS,
    TAPLO_REASON,
    TAPLO_OPTIONS,
    SETTING_REASON,
    LOOSENED_SETTINGS,
    RESTRICTED_IMPORTS,
    EXTRA_OPTION_SCOPES,
};
