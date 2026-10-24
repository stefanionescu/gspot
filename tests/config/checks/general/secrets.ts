export const ENVIRONMENT_FUNCTION_EXAMPLE = `KNOWN=example
MISSING=example
CUSTOM=example
DOLLAR=example
PYTHON=example
OTHER=example
`;

export const ENVIRONMENT_FUNCTION_FINDINGS = [
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'OTHER is read here and appears in no example environment file.',
    },
    {
        file: 'reader.py',
        line: 1,
        rule: 'missing-key',
        message: 'PYTHON is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 1,
        rule: 'missing-key',
        message: 'MISSING is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 2,
        rule: 'missing-key',
        message: 'CUSTOM is read here and appears in no example environment file.',
    },
    {
        file: 'source.ts',
        line: 3,
        rule: 'missing-key',
        message: 'DOLLAR is read here and appears in no example environment file.',
    },
] as const;

export const SCOPE_FUNCTION_CORRECTIONS = {
    '.env.example': 'APP_MISSING=example\nROOT_MISSING=example\n',
    'app/project.env': `APP_KEY=example
SIBLING_MISSING=example
APP_MISSING=example
`,
    'sibling/.env.example': 'KNOWN=example\nSIBLING_MISSING=example\n',
} as const;

export const ENV_ACCESSOR_FILES = {
    'app.astro': '---\nconst endpoint = import.meta.env.VITE_API;\n---\n<main>{endpoint}</main>\n',
    'app.svelte': '<script>const endpoint = import.meta.env["SVELTE_API"];</script>\n<main>{endpoint}</main>\n',
    'app.vue': `<script setup>const endpoint = import.meta.env.VUE_API;</script>
<template>{{ endpoint }}</template>
`,
    'worker.ts': 'const endpoint = Deno.env.get("DENO_API");\nDeno.env.get("DENO_API");\n',
    'module.mts': 'export const endpoint = import.meta.env.MODULE_API;\n',
    'common.cts': 'export const endpoint = process.env.COMMON_API;\n',
    'legacy.cjs': 'exports.endpoint = process.env.LEGACY_API;\n',
    'notes.txt': 'import.meta.env.UNREAD_API; Deno.env.get("UNREAD_API");\n',
} as const;

export const ENV_ACCESSOR_EXAMPLE = `KNOWN=example
VITE_API=example
SVELTE_API=example
VUE_API=example
DENO_API=example
MODULE_API=example
COMMON_API=example
LEGACY_API=example
`;

export const COMPONENT_ENVIRONMENT_FINDINGS = [
    { file: 'app.astro', line: 2, rule: 'missing-key' },
    { file: 'app.svelte', line: 1, rule: 'missing-key' },
    { file: 'app.vue', line: 1, rule: 'missing-key' },
    { file: 'common.cts', line: 1, rule: 'missing-key' },
    { file: 'legacy.cjs', line: 1, rule: 'missing-key' },
    { file: 'module.mts', line: 1, rule: 'missing-key' },
    { file: 'worker.ts', line: 1, rule: 'missing-key' },
] as const;

export const BUN_ENVIRONMENT_RESULTS = [
    {
        check: 'secrets/env-examples',
        status: 'failed',
        findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }],
    },
] as const;

export const ENVIRONMENT_SCOPE_RESULTS = [
    { scope: '', status: 'failed', findings: [{ file: 'source.ts', line: 1, rule: 'missing-key' }] },
    { scope: 'app', status: 'failed', findings: [{ file: 'app/source.ts', line: 1, rule: 'missing-key' }] },
    {
        scope: 'sibling',
        status: 'failed',
        findings: [{ file: 'sibling/source.ts', line: 1, rule: 'missing-key' }],
    },
] as const;
