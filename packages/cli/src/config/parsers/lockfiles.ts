/** Every lockfile gspot knows, which package manager writes it, and which consumers use it. */
export const LOCKFILES = [
    {
        file: 'bun.lock',
        configuration: 'javascript',
        client: 'bun',
        toolProject: true,
        copied: true,
    },
    { file: 'bun.lockb', configuration: 'javascript', client: 'bun' },
    {
        file: 'pnpm-lock.yaml',
        configuration: 'javascript',
        client: 'pnpm',
        toolProject: true,
        copied: true,
    },
    {
        file: 'yarn.lock',
        configuration: 'javascript',
        client: 'yarn',
        toolProject: true,
        copied: true,
    },
    {
        file: 'package-lock.json',
        configuration: 'javascript',
        client: 'npm',
        toolProject: true,
        copied: true,
    },
    { file: 'npm-shrinkwrap.json', configuration: 'javascript', client: 'npm' },
    {
        file: 'uv.lock',
        configuration: 'python',
        client: 'uv',
        copied: true,
    },
    { file: 'poetry.lock', configuration: 'python', client: 'poetry' },
    { file: 'pdm.lock', configuration: 'python', client: 'pdm' },
    { file: 'Cargo.lock', client: 'cargo' },
    { file: 'go.sum', client: 'go' },
    { file: 'Gemfile.lock', client: 'bundler' },
    { file: 'Package.resolved', configuration: 'swift', client: 'swift', copied: true },
    { file: 'Podfile.lock', client: 'cocoapods' },
] as const;

export const PNPM_ROOT_IMPORTER = '.';
