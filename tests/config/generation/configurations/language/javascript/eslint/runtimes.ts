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

export const RUNTIME_OVERRIDE_TABLES = {
    tools: {
        eslint: {
            override: [
                { paths: ['**/*.js'], runtime: 'browser' },
                { paths: ['worker.js'], runtime: 'worker' },
            ],
        },
    },
} as const;

export const RUNTIME_OVERRIDE_SETTINGS = {
    rules: true,
    tables: '[[tools.eslint.override]]\npaths = [ "native/src/browser.js" ]\nruntime = "browser"\n\n[[tools.eslint.override]]\npaths = [ "native/scripts/worker.js" ]\nruntime = "worker"\n\n[[tools.eslint.override]]\npaths = [ "native/server/**/*" ]\nruntime = "node"\n',
    scopes: [
        { path: 'native', configurations: ['react-native'] },
        { path: 'web', configurations: ['react'] },
        { path: 'native/server', configurations: ['javascript'] },
    ],
} as const;
