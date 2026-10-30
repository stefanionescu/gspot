export const TSC_REPLACEMENTS = [
    { configuration: 'vue', check: 'vue/vue-tsc', source: 'src/App.vue', text: '<template><p>App</p></template>' },
] as const;

export const CONFIGURED_CHECK_CASES = [
    {
        name: 'a TypeScript-only scope selects Knip',
        configurations: ['typescript'],
        options: {},
        files: {
            'src/main.ts': 'export const value = 1;\n',
        },
        check: 'javascript/knip',
        selected: true,
    },
    {
        name: 'Prettier stays configured without matching sources',
        configurations: [],
        options: { level: 'all', rules: true },
        files: {
            'main.go': 'package main\nfunc main() {}\n',
            'main.rs': 'fn main() {}\n',
        },
        check: 'format/prettier',
        selected: true,
    },
] as const;

export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;
