export const PNPM_ROOT_IMPORTER = '.';

export const PYTHON_LOCKFILES = ['uv.lock'] as const;

export const JAVASCRIPT_LOCKFILES = [
    'bun.lock',
    'pnpm-lock.yaml',
    'yarn.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
] as const;

export const LOCKED_PACKAGE_LOCKFILES = [...JAVASCRIPT_LOCKFILES, ...PYTHON_LOCKFILES] as const;

export const PNPM_PEER_START = '(';

export const IMPORTER_LOCKFILES = ['bun.lock', 'package-lock.json', 'pnpm-lock.yaml'] as const;

export const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
