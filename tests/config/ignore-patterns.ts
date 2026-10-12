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

/** Real authored files stay eligible while declarations, ordinary excludes, and consumable lockfiles stay ignored. */
export const PRETTIER_IGNORE_CASES = [
    { file: 'tests/build/Scenario.ts', ignored: false },
    { file: 'src/dist/source.ts', ignored: false },
    { file: 'coverage/source.ts', ignored: false },
    { file: 'build/source.ts', ignored: false },
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
        ignored: ['.venv/', 'uv.lock'],
        absent: ['.build/', 'Package.resolved'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'Swift without JavaScript',
        settings: 'configurations = ["format", "markdown", "swift"]\n',
        ignored: ['.build/', 'DerivedData/', 'Pods/', 'Package.resolved'],
        absent: ['node_modules/', 'package-lock.json', '.venv/', 'uv.lock'],
        pointer: false,
        markdownPointer: '',
    },
    {
        name: 'JavaScript',
        settings: 'configurations = ["format", "markdown", "javascript"]\n',
        ignored: ['node_modules/', 'package-lock.json', 'pnpm-lock.yaml'],
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
        ignored: ['.venv/', 'uv.lock', 'node_modules/', 'package-lock.json'],
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
