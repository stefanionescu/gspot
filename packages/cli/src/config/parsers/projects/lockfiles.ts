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

export const LOCKFILE_URL_FIELDS = ['resolved', 'tarball', 'repo', 'resolution'];

export const YARN_CLASSIC_PROPERTY = /^[\t ]+(?:version|resolved|integrity)[\t ]+"/mu;
export const YARN_CLASSIC_HEADER = '# yarn lockfile v1\n';
