/** Runtime distinctions that catch merged globals and service-worker substitution. */
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
        runtime: 'service-worker',
        globals: ['clients', 'skipWaiting', 'importScripts'],
        absent: ['process', 'Buffer', 'require', '__dirname', 'DedicatedWorkerGlobalScope'],
    },
    {
        runtime: 'react-native',
        globals: ['__DEV__', 'process', 'require'],
        absent: ['Buffer', '__dirname', '__filename', 'module'],
    },
];

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
];

/** Authored values that must fail validation before a render template runs. */
export const INVALID_RUNTIMES = [
    'desktop',
    'serviceworker',
    'node }; globalThis.injected = true; //',
    'node"\n/* café */',
];
