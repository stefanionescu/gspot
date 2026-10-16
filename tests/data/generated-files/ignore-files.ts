/** Inventory declarations and check path ignores reach native Prettier patterns. */
export const PRETTIER_IGNORE_SETTINGS = {
    configurations: ['format', 'javascript'],
    ignore: [
        {
            check: 'format/prettier',
            paths: ['authored/omitted.ts'],
            reason: 'This output retains its authored layout.',
        },
    ],
} as const;

/** Shared build folders, declarations, and selected lockfiles stay excluded while other source files remain eligible. */
export const PRETTIER_IGNORE_CASES = [
    { file: 'tests/build/Scenario.ts', ignored: true },
    { file: 'src/dist/source.ts', ignored: true },
    { file: 'coverage/source.ts', ignored: true },
    { file: 'build/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'vendored/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'package-lock.json', ignored: true },
    { file: 'pnpm-lock.yaml', ignored: true },
] as const;

export const LANGUAGE_IGNORES = [
    {
        name: 'Python without JavaScript',
        settings: 'configurations = ["format", "markdown", "python"]\n',
        ignored: ['.venv/'],
        absent: ['.build/', 'Package.resolved'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'Swift without JavaScript',
        settings: 'configurations = ["format", "markdown", "swift"]\n',
        ignored: ['.build/', 'DerivedData/', 'Pods/'],
        absent: ['node_modules/', 'package-lock.json', '.venv/', 'uv.lock'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'JavaScript',
        settings: 'configurations = ["format", "markdown", "javascript"]\n',
        ignored: ['node_modules/'],
        absent: ['.build/', 'Package.resolved', '.venv/', 'uv.lock'],
        pointer: true,
        markdownPointer: '.markdownlint-cli2.mjs',
    },
    {
        name: 'a JavaScript child of Python',
        settings: `configurations = ["format", "markdown", "python"]
[[scope]]
path = "web"
configurations = ["javascript"]
`,
        ignored: ['.venv/', 'node_modules/'],
        absent: ['.build/', 'Package.resolved'],
        pointer: true,
        markdownPointer: 'web/.markdownlint-cli2.mjs',
    },
] as const;

/** Check-specific file ignores reach the native discovery owners that read them. */
export const PATH_IGNORE_CASES = [
    {
        configuration: 'spelling',
        check: 'spelling/typos',
        path: '.gspot/config/typos.toml',
        nativePath: ['files', 'extend-exclude'],
    },
    {
        configuration: 'duplication',
        check: 'duplication/jscpd',
        path: '.gspot/config/jscpd.json',
        nativePath: ['ignore'],
    },
    { configuration: 'javascript', check: 'javascript/knip', path: '.gspot/config/knip.json', nativePath: ['ignore'] },
] as const;

export const SCOPE_PATTERN_CASES = [
    { pattern: '/{apps,packages}/web/file.ts', expected: ['/file.ts'] },
    { pattern: '/{apps,{services,packages}}/web/file.ts', expected: ['/file.ts'] },
    { pattern: String.raw`/apps/web/{a\,b,c}.ts`, expected: [String.raw`/a\,b.ts`, '/c.ts'] },
    { pattern: '/apps/web/a[{,}]b', expected: ['/a[{,}]b'] },
    { pattern: '/apps/web/[{a,b}.ts', expected: ['/[{a,b}.ts'] },
    { pattern: String.raw`/apps/web/[a\]{b,c}]`, expected: [String.raw`/[a\]{b,c}]`] },
    { pattern: '/apps/web/[{a,b}\\', expected: ['/[{a,b}\\'] },
    { pattern: String.raw`/apps/web/\{a,b}.ts`, expected: [String.raw`/\{a,b}.ts`] },
    { pattern: '/apps/web/}{a,b}.ts', expected: ['/}a.ts', '/}b.ts'] },
    { pattern: '/apps/web/{a,a}.ts', expected: ['/a.ts'] },
] as const;

export const PRETTIER_IGNORE_ATTRIBUTES = '/generated/** linguist-generated\n/vendored/** linguist-vendored\n';

export const SEMGREP_IGNORE_CASES = [
    {
        name: 'identical scope ignores reuse the root file',
        configurations: ['bash'],
        tables: `[[scope]]
path = "first"

[[scope]]
path = "second"

`,
        sources: { 'sample.sh': 'echo sample\n' },
        paths: ['.semgrepignore'],
        swift: false,
        patterns: [],
    },
    {
        name: 'custom scope ignores retain the relative pattern',
        configurations: ['bash'],
        tables: `[[scope]]
path = "child"

[[ignore]]
check = "security/semgrep"
paths = ["child/legacy/**"]
reason = "Reviewed legacy scripts are maintained separately."
`,
        sources: { 'sample.sh': 'echo sample\n', 'child/legacy/script.sh': 'echo legacy\n' },
        paths: ['.semgrepignore'],
        swift: false,
        patterns: [{ path: '.semgrepignore', text: 'child/legacy/**' }],
    },
    {
        name: 'Swift selection adds its ignored build folders',
        configurations: ['swift'],
        tables: '',
        sources: { 'example.swift': 'let value = 1\n' },
        paths: ['.semgrepignore'],
        swift: true,
        patterns: [],
    },
] as const;
