import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const SVELTE_PROJECTS = [
    {
        name: 'root JavaScript',
        typeRoots: ['node_modules/@types'],
        scope: '',
        settings: buildSandboxSettings(['svelte'], { scopes: [{ path: 'app' }] }),
        files: {},
        extends: null,
        include: ['Component.svelte'],
    },
    {
        name: 'scoped TypeScript',
        typeRoots: ['app/node_modules/@types', 'node_modules/@types'],
        scope: 'app',
        settings: buildSandboxSettings(['svelte', 'typescript'], { scopes: [{ path: 'app' }] }),
        files: {
            'app/tsconfig.json': JSON.stringify({ compilerOptions: { strict: true }, include: ['Component.svelte'] }),
        },
        extends: 'app/tsconfig.json',
        include: null,
    },
] as const;

export const SVELTE_CHECK_OUTPUT = `1758823456789 START "/repo"
1758823456790 {"type":"ERROR","filename":"src/Count.svelte","start":{"line":1,"character":10},"end":{"line":1,"character":15},"message":"Type 'string' is not assignable to type 'number'.","code":2322,"source":"ts"}
1758823456791 {"type":"WARNING","filename":"src/Product.svelte","start":{"line":4,"character":0},"end":{"line":4,"character":20},"message":"\`<img>\` element should have an alt attribute","code":"a11y_missing_attribute","source":"svelte"}
1758823456792 COMPLETED 2 FILES 1 ERRORS 1 WARNINGS 2 FILES_WITH_PROBLEMS`;

export const SVELTE_CHECK_FINDINGS = [
    {
        check: 'svelte/svelte-check',
        file: 'src/Count.svelte',
        line: 2,
        column: 11,
        rule: 'TS2322',
        message: "Type 'string' is not assignable to type 'number'.",
        fixable: false,
    },
    {
        check: 'svelte/svelte-check',
        file: 'src/Product.svelte',
        line: 5,
        column: 1,
        rule: 'a11y_missing_attribute',
        message: '`<img>` element should have an alt attribute',
        fixable: false,
    },
] as const;
