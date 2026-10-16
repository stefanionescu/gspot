/** Every lockfile gspot knows, which package manager writes it, and which consumers use it. */
export const LOCKFILES = [
    {
        file: 'bun.lock',
        configuration: 'javascript',
        packageManager: 'bun',
        toolProject: true,
        copied: true,
    },
    { file: 'bun.lockb', configuration: 'javascript', packageManager: 'bun' },
    {
        file: 'pnpm-lock.yaml',
        configuration: 'javascript',
        packageManager: 'pnpm',
        toolProject: true,
        copied: true,
    },
    {
        file: 'yarn.lock',
        configuration: 'javascript',
        packageManager: 'yarn',
        toolProject: true,
        copied: true,
    },
    {
        file: 'package-lock.json',
        configuration: 'javascript',
        packageManager: 'npm',
        toolProject: true,
        copied: true,
    },
    { file: 'npm-shrinkwrap.json', configuration: 'javascript', packageManager: 'npm' },
    {
        file: 'uv.lock',
        configuration: 'python',
        packageManager: 'uv',
        copied: true,
    },
    { file: 'poetry.lock', configuration: 'python', packageManager: 'poetry' },
    { file: 'pdm.lock', configuration: 'python', packageManager: 'pdm' },
    { file: 'Cargo.lock', packageManager: 'cargo' },
    { file: 'go.sum', packageManager: 'go' },
    { file: 'Gemfile.lock', packageManager: 'bundler' },
    { file: 'Package.resolved', configuration: 'swift', packageManager: 'swift', copied: true },
    { file: 'Podfile.lock', packageManager: 'cocoapods' },
] as const;

export const PNPM_ROOT_IMPORTER = '.';
