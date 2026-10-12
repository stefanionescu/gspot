/** Every lockfile gspot knows, which package manager writes it, and the patterns that identify stale content. */
export const LOCKFILES = [
    {
        file: 'bun.lock',
        configuration: 'javascript',
        client: 'bun',
        toolProject: true,
        copied: true,
        frozen: ['bun', 'install', '--frozen-lockfile', '--dry-run'],
        stale: /lockfile had changes, but lockfile is frozen/u,
    },
    { file: 'bun.lockb', configuration: 'javascript', client: 'bun' },
    {
        file: 'pnpm-lock.yaml',
        configuration: 'javascript',
        client: 'pnpm',
        toolProject: true,
        copied: true,
        frozen: ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
        stale: /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE)/u,
    },
    {
        file: 'yarn.lock',
        configuration: 'javascript',
        client: 'yarn',
        toolProject: true,
        copied: true,
        frozen: ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
        stale: /Your lockfile needs to be updated|YN0028|lockfile would have been modified/u,
    },
    {
        file: 'package-lock.json',
        configuration: 'javascript',
        client: 'npm',
        toolProject: true,
        copied: true,
        frozen: ['npm', 'ci', '--dry-run', '--ignore-scripts'],
        stale: /can only install packages when your package\.json and package-lock\.json or npm-shrinkwrap\.json are in sync/u,
    },
    { file: 'npm-shrinkwrap.json', configuration: 'javascript', client: 'npm' },
    {
        file: 'uv.lock',
        configuration: 'python',
        client: 'uv',
        copied: true,
        frozen: ['uv', 'lock', '--check'],
        stale: /lockfile[\s\S]*needs to be updated/u,
    },
    { file: 'poetry.lock', configuration: 'python', client: 'poetry' },
    { file: 'pdm.lock', configuration: 'python', client: 'pdm' },
    { file: 'Cargo.lock', client: 'cargo' },
    { file: 'go.sum', client: 'go' },
    { file: 'Gemfile.lock', client: 'bundler' },
    { file: 'Package.resolved', configuration: 'swift', client: 'swift', copied: true },
    { file: 'Podfile.lock', client: 'cocoapods' },
] as const;

export const YARN_LOCKFILE = 'yarn.lock';
export const YARN_BERRY_LOCKFILE = /^__metadata:/mu;
export const YARN_BERRY_FROZEN = ['yarn', 'install', '--immutable'] as const;

// eslint-disable-next-line gspot/no-alias-exports -- reason: This fixed value selects the uv file name from the single lockfile table; callers do not own its row position.
export const UV_LOCKFILE_NAME = LOCKFILES[6].file;

export const PNPM_ROOT_IMPORTER = '.';
