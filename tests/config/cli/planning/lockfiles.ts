/** Manifest and lockfile changes trigger frozen installs. Other project inputs remain analysis-only. */
export const LOCKFILE_TRIGGER_NAMES = [
    'package.json',
    'bun.lock',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'pyproject.toml',
    'uv.lock',
];
