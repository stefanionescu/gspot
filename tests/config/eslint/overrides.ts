/** Runtime distinctions that catch merged globals and serviceworker substitution. */
export const RUNTIME_CASES = [
    {
        runtime: 'browser',
        globals: ['window', 'document'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'importScripts'],
    },
    {
        runtime: 'worker',
        globals: ['postMessage', 'DedicatedWorkerGlobalScope', 'importScripts'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'clients'],
    },
    {
        runtime: 'serviceworker',
        globals: ['clients', 'skipWaiting', 'importScripts'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'DedicatedWorkerGlobalScope'],
    },
    {
        runtime: 'react-native',
        globals: ['__DEV__', 'process', 'require'],
        absent: ['Buffer', '__dirname', '__filename', 'module'],
    },
] as const;

/** Presets with their own globals must still respect an authored runtime. */
export const FRAMEWORK_RUNTIME_CASES = [
    {
        configuration: 'vue',
        path: 'src/Worker.vue',
        source: '<script setup>postMessage("value"); window.alert("value"); process.exit(0);</script><template><p>worker</p></template>\n',
    },
    {
        configuration: 'svelte',
        path: 'src/Worker.svelte',
        source: '<script>postMessage("value"); window.alert("value"); process.exit(0);</script><p>worker</p>\n',
    },
] as const;

// A JavaScript settings with ESLint rules and overrides at the root, in a nested scope, and in a scope inside it.
/** Rule settings and overrides that the generated configuration and an exported template both read. */
export const ESLINT_OVERRIDES_SETTINGS = `configurations = [ "javascript" ]

[rules]
enabled = false

[tools.eslint.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "tests" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[tools.eslint.override]]
paths = [ "tests/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/**", "!apps/web/exempt.js" ]

[tools.eslint.override.rules]
eqeqeq = [ "smart" ]

[[tools.eslint.override]]
paths = [ "apps/web/admin/**" ]

[tools.eslint.override.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web"

[scope.tools.eslint.rules]
eqeqeq = [ "always" ]

[[scope]]
path = "apps/web/admin"
`;

/** Authored runtime values rejected by the settings reader. */
export const INVALID_RUNTIMES = ['desktop', 'node }; globalThis.injected = true; //', 'node"\n/* café */'] as const;
