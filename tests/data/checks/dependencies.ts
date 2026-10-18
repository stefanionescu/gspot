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

// A hold of fourteen days that the user wrote in bunfig.toml.
export const TWO_WEEKS_SECONDS = 1_209_600;

/** The two gspot packages, which every package manager leaves out of the hold. */
export const OWN_PACKAGES = ['@gspothq/cli', '@gspothq/eslint-plugin'] as const;

/** The file that shows each installer in use, and the settings file that gets no release hold from gspot. */
export const INSTALLER_FILES = [
    {
        installer: 'Bun',
        files: { 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' },
        path: 'bunfig.toml',
    },
    { installer: 'npm', files: { 'package-lock.json': '{"lockfileVersion":3,"packages":{}}' }, path: '.npmrc' },
    { installer: 'pnpm', files: { 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" }, path: 'pnpm-workspace.yaml' },
    { installer: 'Yarn', files: { 'yarn.lock': '__metadata:\n  version: 8\n' }, path: '.yarnrc.yml' },
    { installer: 'uv', files: { 'uv.lock': 'version = 1\n' }, path: 'pyproject.toml' },
    { installer: 'mise', files: { 'mise.toml': '[tools]\nnode = "24"\n' }, path: 'mise.toml' },
] as const;

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
