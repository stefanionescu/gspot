export const FAILED_DOCTOR_OUTPUT = `Running 15 checks on your project...
\u{1B}[32m✔\u{1B}[39m Check package.json for common issues
\u{1B}[31m✖\u{1B}[39m Check that packages match versions required by installed Expo SDK
\u{1B}[33mThe following packages should be updated for best compatibility with the installed expo version:\u{1B}[39m
\u{1B}[33m  react-native@0.81.4 - expected version: 0.81.5\u{1B}[39m
\u{1B}[32mAdvice:\u{1B}[39m
\u{1B}[32mUse 'npx expo install --check' to review and upgrade your dependencies.\u{1B}[39m

✖ Check for app config fields that may not be synced in a non-CNG project
This project contains native project folders but also has native configuration properties in app.json.

13/15 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.`;

export const APP_FOLDERS = ['apps/first', 'apps/second'] as const;

export const EXPO_PACKAGE_JSON = '{"private":true,"dependencies":{"expo":"54.0.0"}}\n';

export const NEXT_CACHE_BYTES = [0, 255, 1, 2] as const;

export const AUTHORED_NEXT_ENV = '// Authored type declaration\n';

export const ROUTE_TYPES_COMMENT = '// Retained route types\n';

export const UNRELATED_FILE = { path: 'unrelated/private.txt', text: 'Preserve unrelated scope\n' } as const;

export const GENERATED_ROUTES = '// Generated routes\n';

export const SVELTE_PROJECTS = [
    {
        name: 'root JavaScript',
        scope: '',
        configurations: ['svelte'],
        files: {},
        extends: null,
        include: ['Component.svelte'],
    },
    {
        name: 'scoped TypeScript',
        scope: 'app',
        configurations: ['svelte', 'typescript'],
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
        help: 'Fix each warning and error svelte-check prints; both fail the check.',
    },
    {
        check: 'svelte/svelte-check',
        file: 'src/Product.svelte',
        line: 5,
        column: 1,
        rule: 'a11y_missing_attribute',
        message: '`<img>` element should have an alt attribute',
        fixable: false,
        help: 'Fix each warning and error svelte-check prints; both fail the check.',
    },
] as const;
