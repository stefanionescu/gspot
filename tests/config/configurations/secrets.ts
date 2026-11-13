export const COMPONENT_ENVIRONMENT_FINDINGS = [
    { file: 'app.astro', line: 2, rule: 'missing-key' },
    { file: 'app.svelte', line: 1, rule: 'missing-key' },
    { file: 'app.vue', line: 1, rule: 'missing-key' },
    { file: 'legacy.cjs', line: 1, rule: 'missing-key' },
    { file: 'module.mts', line: 1, rule: 'missing-key' },
    { file: 'worker.ts', line: 1, rule: 'missing-key' },
] as const;
export const ENVIRONMENT_FUNCTION_EXAMPLE = `KNOWN=example
MISSING=example
CUSTOM=example
DOLLAR=example
PYTHON=example
OTHER=example
`;
export const ENVIRONMENT_FUNCTION_FINDINGS = [
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'MISSING' },
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'OTHER' },
    { file: 'reader.py', line: 1, rule: 'missing-key', key: 'PYTHON' },
    { file: 'source.ts', line: 1, rule: 'missing-key', key: 'MISSING' },
    { file: 'source.ts', line: 2, rule: 'missing-key', key: 'CUSTOM' },
    { file: 'source.ts', line: 3, rule: 'missing-key', key: 'DOLLAR' },
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
export const ENV_ACCESSOR_EXAMPLE = `KNOWN=example
VITE_API=example
SVELTE_API=example
VUE_API=example
DENO_API=example
MODULE_API=example
LEGACY_API=example
`;
