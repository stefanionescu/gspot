const SEVEN_DAYS_IN_SECONDS = '604800';

const DEPENDENCIES_REPOSITORY = {
    configurations: ['dependencies'],

    files: {
        'package.json': `{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.4.2"\n}\n`,
    },
} as const;

const BUN_RELEASE_AGE_CASES = [
    {
        check: 'dependencies/bun-release-age',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': `[install]\nminimumReleaseAge = 3600\n` },
        expected: { file: 'bunfig.toml', rule: 'release-age', line: 1 },
        corrected: {
            files: { 'bun.lock': '{}\n', 'bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}\n` },
        },
    },
    {
        check: 'dependencies/bun-release-age',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}\n` },
        settings: '[dependencies]\nscanner = "@socketsecurity/bun-security-scanner"\n',
        expected: { file: 'bunfig.toml', rule: 'security-scanner', line: 1 },
        corrected: {
            files: {
                'bun.lock': '{}\n',
                'bunfig.toml': `[install]
minimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}
[install.security]
scanner = "@socketsecurity/bun-security-scanner"
`,
            },
        },
    },
] as const;

const LOCKFILE_HOST_CASES = [
    {
        check: 'dependencies/lockfile-hosts',
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
        check: 'dependencies/lockfile-hosts',
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
        check: 'dependencies/lockfile-hosts',
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
        check: 'dependencies/lockfile-hosts',
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

const HOST_LOCKFILE = {
    packages: {
        'node_modules/first': { resolved: 'https://github.com/example/first/archive/abcdef.tar.gz' },
        'node_modules/second': { resolved: 'https://codeload.github.com/example/second/tar.gz/abcdef' },
        'node_modules/third': { resolved: 'https://github.com/example/third/archive/abcdef.tar.gz' },
    },
} as const;

// Fourteen days exceeds the shipped minimum of seven days.
const TWO_WEEKS_SECONDS = 1_209_600;

const AGE_CASES = [
    { name: 'absent', source: undefined, expected: 604_800 },
    { name: 'weaker', source: '[install]\nminimumReleaseAge = 3600\n', expected: 604_800 },
    { name: 'stricter', source: '[install]\nminimumReleaseAge = 1209600\n', expected: TWO_WEEKS_SECONDS },
] as const;

/** Local dependency projects retain their exact authored manifests. */
const LOCAL_NPM_PROJECT = {
    manifestPath: 'package.json',
    manifest: '{"private":true,"dependencies":{"library":"file:./library"}}',
    changed: '{"private":true,"dependencies":{"other":"file:./other"}}',
    files: {
        'library/package.json': '{"name":"library","version":"1.0.0"}\n',
        'other/package.json': '{"name":"other","version":"1.0.0"}\n',
    },
} as const;

const LOCAL_UV_PROJECT = {
    manifestPath: 'pyproject.toml',
    manifest: `[project]
name = "example"
version = "1.0.0"
dependencies = ["library"]
[tool.uv.sources]
library = { path = "library" }
other = { path = "other" }
`,
    changed: `[project]
name = "example"
version = "1.0.0"
dependencies = ["other"]
[tool.uv.sources]
library = { path = "library" }
other = { path = "other" }
`,
    files: {
        'library/pyproject.toml': `[project]
name = "library"
version = "1.0.0"
`,
        'other/pyproject.toml': `[project]
name = "other"
version = "1.0.0"
`,
    },
} as const;

const LOCKFILES = [
    {
        ...LOCAL_NPM_PROJECT,
        name: 'Bun',
        lockfileName: 'bun.lock',
        command: ['bun', 'install', '--lockfile-only', '--ignore-scripts'],
    },
    {
        ...LOCAL_NPM_PROJECT,
        name: 'npm',
        lockfileName: 'package-lock.json',
        command: ['npm', 'install', '--package-lock-only', '--ignore-scripts'],
    },
    {
        ...LOCAL_NPM_PROJECT,
        name: 'Yarn Classic',
        lockfileName: 'yarn.lock',
        command: ['yarn', 'install', '--non-interactive', '--ignore-scripts'],
    },
    {
        ...LOCAL_NPM_PROJECT,
        name: 'pnpm',
        lockfileName: 'pnpm-lock.yaml',
        command: ['pnpm', 'install', '--lockfile-only', '--ignore-scripts'],
    },
    { ...LOCAL_UV_PROJECT, name: 'uv', lockfileName: 'uv.lock', command: ['uv', 'lock'] },
] as const;

/** Syncpack filenames for replacement checks. */
const SYNCPACK_FILES = [
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

export {
    AGE_CASES,
    LOCKFILES,
    HOST_LOCKFILE,
    SYNCPACK_FILES,
    TWO_WEEKS_SECONDS,
    LOCKFILE_HOST_CASES,
    SEVEN_DAYS_IN_SECONDS,
    BUN_RELEASE_AGE_CASES,
    DEPENDENCIES_REPOSITORY,
};
