export const DEPENDENCIES_SANDBOX = {
    configurations: ['dependencies'],

    files: {
        'package.json': `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.4.2"\n}\n`,
    },
} as const;

export const LOCKFILE_HOST_CASES = [
    {
        check: 'dependencies/lockfiles',
        files: {
            'package-lock.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
        },
        expected: { file: 'package-lock.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'package-lock.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'npm-shrinkwrap.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.example.test/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
        },
        expected: { file: 'npm-shrinkwrap.json', rule: 'host', line: 2 },
        corrected: {
            files: {
                'npm-shrinkwrap.json': `{
    "packages": { "node_modules/a": { "resolved": "https://registry.npmjs.org/a/-/a-1.0.0.tgz", "funding": { "url": "https://opencollective.com/a" } } }
}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'pnpm-lock.yaml': `lockfileVersion: '9.0'
packages:
  a@1.0.0:
    resolution: {tarball: https://registry.example.test/a/-/a-1.0.0.tgz}
`,
        },
        expected: { file: 'pnpm-lock.yaml', rule: 'host', line: 4 },
        corrected: {
            files: {
                'pnpm-lock.yaml': `lockfileVersion: '9.0'
packages:
  a@1.0.0:
    resolution: {tarball: https://registry.npmjs.org/a/-/a-1.0.0.tgz}
`,
            },
        },
    },
    {
        check: 'dependencies/lockfiles',
        files: {
            'yarn.lock': `a@1.0.0:
  version "1.0.0"
  resolved "https://registry.example.test/a/-/a-1.0.0.tgz#0a1b"
`,
        },
        expected: { file: 'yarn.lock', rule: 'host', line: 3 },
        corrected: {
            files: {
                'yarn.lock': `a@1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/a/-/a-1.0.0.tgz#0a1b"
`,
            },
        },
    },
] as const;

export const HOST_LOCKFILE = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
} as const;

// Fourteen days exceeds the shipped minimum of seven days.
export const TWO_WEEKS_SECONDS = 1_209_600;

export const AGE_CASES = [
    { name: 'absent', source: undefined, expected: 604_800 },
    { name: 'weaker', source: '[install]\nminimumReleaseAge = 3600\n', expected: 604_800 },
    { name: 'stricter', source: '[install]\nminimumReleaseAge = 1209600\n', expected: TWO_WEEKS_SECONDS },
] as const;

/** The two gspot packages, which every package manager leaves out of the hold. */
export const OWN_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

/** The file that shows each package manager in use, and the hold that gspot writes for it at the default seven days. */
export const HOLD_CASES = [
    {
        installer: 'Bun',
        files: { 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' },
        path: 'bunfig.toml',
        changes: [
            { path: ['install', 'minimumReleaseAge'], value: 604_800 },
            { path: ['install', 'minimumReleaseAgeExcludes'], value: [...OWN_PACKAGES] },
        ],
    },
    {
        installer: 'npm',
        files: { 'package-lock.json': '{"lockfileVersion":3,"packages":{}}' },
        path: '.npmrc',
        changes: [
            { path: ['min-release-age'], value: '7' },
            { path: ['min-release-age-exclude'], value: [...OWN_PACKAGES] },
        ],
    },
    {
        installer: 'pnpm',
        files: { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" },
        path: 'pnpm-workspace.yaml',
        changes: [
            { path: ['minimumReleaseAge'], value: 10_080 },
            { path: ['minimumReleaseAgeExclude'], value: [...OWN_PACKAGES] },
        ],
    },
    {
        installer: 'Yarn',
        files: { 'yarn.lock': '__metadata:\n  version: 8\n' },
        path: '.yarnrc.yml',
        changes: [
            { path: ['npmMinimalAgeGate'], value: 10_080 },
            { path: ['npmPreapprovedPackages'], value: [...OWN_PACKAGES] },
        ],
    },
    {
        installer: 'uv',
        files: { 'uv.lock': 'version = 1\n' },
        path: 'pyproject.toml',
        changes: [{ path: ['tool', 'uv', 'exclude-newer'], value: '7 days' }],
    },
    {
        installer: 'mise',
        files: { 'mise.toml': '[tools]\nnode = "24"\n' },
        path: 'mise.toml',
        changes: [
            { path: ['settings', 'minimum_release_age'], value: '7d' },
            { path: ['settings', 'minimum_release_age_excludes'], value: ['npm:@gspothq/cli'] },
        ],
    },
] as const;

/** A Yarn 1 lockfile. Yarn 1 has no release hold. */
export const YARN_CLASSIC_LOCKFILE =
    '# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n';

/** An .npmrc with a longer hold, its own exclude, and a token line that must stay. */
export const TOKEN_NPMRC =
    'min-release-age=14\nmin-release-age-exclude=@acme/tools\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n';

/** A pnpm workspace file with comments and packages that must stay. */
export const PNPM_WORKSPACE = "# Workspace packages\npackages:\n  - 'apps/*'\n";

/** Syncpack filenames for replacement checks. */
export const SYNCPACK_FILES = [
    {
        file: '.syncpackrc.yaml',
        source: `versionGroups:
  - dependencies: [fixture]
    isIgnored: true
`,
    },
    {
        file: '.syncpackrc.yml',
        source: `versionGroups:
  - dependencies: [fixture]
    isIgnored: true
`,
    },
    {
        file: '.syncpackrc.ts',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
    {
        file: '.syncpackrc.mjs',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
    {
        file: 'syncpack.config.ts',
        source: 'export default { versionGroups: [{ dependencies: ["fixture"], isIgnored: true }] };\n',
    },
] as const;

/** An .npmrc with Windows line endings, a list written with `[]`, and a comment. */
export const NPMRC_LIST_CRLF =
    '; registry settings\r\nmin-release-age-exclude[]=@acme/tools\r\nregistry=https://registry.npmjs.org/\r\n';

/** Each packageManager value, and whether the release-age check reports it. */
export const HOLD_VERSION_CASES = [
    { packageManager: 'npm@10.9.2', message: 'npm 10.9.2 ignores min-release-age' },
    { packageManager: 'npm@11.17.0', message: undefined },
    { packageManager: 'yarn@1.22.22', message: 'yarn 1.22.22 ignores npmMinimalAgeGate' },
    { packageManager: 'pnpm@10.30.0', message: undefined },
    { packageManager: 'bun@1.2.23', message: 'bun 1.2.23 ignores minimumReleaseAge' },
] as const;
