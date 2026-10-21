const SET_SETTINGS = `configurations = ["markdown", "structure"]
[rules]
enabled = false
[[scope]]
path = "api"
configurations = ["bash"]
`;

/** The root and a child scope, where set writes banned words. */
const BANNED_WORD_SCOPES = [
    { name: 'root', scope: '' },
    { name: 'child', scope: 'app' },
] as const;

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
] as const;

const RESTRICTED_IMPORTS = `[{name = "unreviewed-module", message = "Import the reviewed entrypoint for this dependency."}]`;

const SETTING_REASON = 'The project contract requires this reviewed exception.';

/** The banned word written by the set command tests. */
const SCOPE_BANNED_WORDS = ['discardedword'] as const;

export { SET_SETTINGS, SETTING_REASON, LOOSENED_SETTINGS, SCOPE_BANNED_WORDS, RESTRICTED_IMPORTS, BANNED_WORD_SCOPES };
