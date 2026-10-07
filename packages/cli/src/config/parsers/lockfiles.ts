/** The package-lock format that carries both the packages table and the old dependencies tree. */
export const HYBRID_LOCKFILE = 2;

/** The package-lock format that carries the packages table alone. */
export const PACKAGES_LOCKFILE = 3;

export const LOCKFILE_VERSIONS = [HYBRID_LOCKFILE, PACKAGES_LOCKFILE] as const;

/** Lockfile clients, runner priority, tool projects, and native verification. */
export const LOCKFILES = [
    {
        file: 'bun.lock',
        client: 'bun',
        runner: true,
        private: true,
        parsed: true,
        snapshot: true,
        frozen: ['bun', 'install', '--frozen-lockfile', '--dry-run'],
    },
    { file: 'bun.lockb', client: 'bun', runner: true },
    {
        file: 'pnpm-lock.yaml',
        client: 'pnpm',
        runner: true,
        private: true,
        parsed: true,
        snapshot: true,
        frozen: ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
    },
    {
        file: 'yarn.lock',
        client: 'yarn',
        runner: true,
        private: true,
        parsed: true,
        snapshot: true,
        frozen: ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
    },
    {
        file: 'package-lock.json',
        client: 'npm',
        runner: true,
        private: true,
        parsed: true,
        snapshot: true,
        frozen: ['npm', 'ci', '--dry-run', '--ignore-scripts'],
    },
    { file: 'npm-shrinkwrap.json', client: 'npm' },
    { file: 'uv.lock', client: 'uv', parsed: true, snapshot: true, frozen: ['uv', 'lock', '--check'] },
    { file: 'poetry.lock', client: 'poetry', parsed: true },
    { file: 'pdm.lock', client: 'pdm', parsed: true },
    { file: 'Cargo.lock', client: 'cargo' },
    { file: 'go.sum', client: 'go' },
    { file: 'Gemfile.lock', client: 'bundler' },
    { file: 'Package.resolved', client: 'swift', snapshot: true },
    { file: 'Podfile.lock', client: 'cocoapods' },
] as const;
