import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

/** The checks that replace typescript/tsc, with a source file that each one reads. */
export const TSC_REPLACEMENTS = [
    { configuration: 'vue', check: 'vue/vue-tsc', source: 'src/App.vue', text: '<template><p>App</p></template>' },
    { configuration: 'svelte', check: 'svelte/svelte-check', source: 'src/App.svelte', text: '<p>App</p>' },
] as const;

/** Repositories whose files decide whether gspot configures a check. */
export const CONFIGURED_CHECK_CASES = [
    {
        name: 'a TypeScript-only scope selects Knip',
        files: {
            'gspot.toml': buildSandboxSettings(['typescript'], { tables: '[rules]\nenabled = false\n' }),
            'src/main.ts': 'export const value = 1;\n',
        },
        check: 'javascript/knip',
        selected: true,
    },
    {
        name: 'Go and Rust sources do not select Prettier',
        files: {
            'gspot.toml': buildSandboxSettings([], { level: 'all', rules: true }),
            'main.go': 'package main\nfunc main() {}\n',
            'main.rs': 'fn main() {}\n',
        },
        check: 'format/prettier',
        selected: false,
    },
] as const;

/** The coverage commands without their coverage arguments. */
export const STRIPPED_COVERAGE_COMMANDS: Record<string, string[]> = {
    'jest/coverage': ['jest', '--ci', '--rootDir={root}/{scope}'],
    'vitest/coverage': ['vitest', 'run'],
    'pytest/coverage': ['pytest', '-q', '--strict-markers', '--strict-config', '--no-header', '-p', 'no:cacheprovider'],
};

/** Ignores of a whole scope and the scopes where the replaced check still runs. */
export const SCOPE_WIDE_IGNORE_CASES = [
    { paths: ['api/**'], ignored: true },
    { paths: ['api'], ignored: true },
    { paths: ['api/**', '!api/app/**'], ignored: false },
] as const;
