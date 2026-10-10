/** Local dependency projects retain their exact authored manifests. */
const JAVASCRIPT_PROJECT = {
    manifestPath: 'package.json',
    manifest: '{"private":true,"dependencies":{"library":"file:./library"}}',
    changed: '{"private":true,"dependencies":{"other":"file:./other"}}',
    files: {
        'library/package.json': '{"name":"library","version":"1.0.0"}\n',
        'other/package.json': '{"name":"other","version":"1.0.0"}\n',
    },
};
const PYTHON_PROJECT = {
    manifestPath: 'pyproject.toml',
    manifest:
        '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["library"]\n[tool.uv.sources]\nlibrary = { path = "library" }\nother = { path = "other" }\n',
    changed:
        '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["other"]\n[tool.uv.sources]\nlibrary = { path = "library" }\nother = { path = "other" }\n',
    files: {
        'library/pyproject.toml': '[project]\nname = "library"\nversion = "1.0.0"\n',
        'other/pyproject.toml': '[project]\nname = "other"\nversion = "1.0.0"\n',
    },
};

export const NATIVE_LOCKFILES = [
    {
        ...JAVASCRIPT_PROJECT,
        name: 'Bun',
        lockfileName: 'bun.lock',
        command: ['bun', 'install', '--lockfile-only', '--ignore-scripts'],
    },
    {
        ...JAVASCRIPT_PROJECT,
        name: 'npm',
        lockfileName: 'package-lock.json',
        command: ['npm', 'install', '--package-lock-only', '--ignore-scripts'],
    },
    {
        ...JAVASCRIPT_PROJECT,
        name: 'Yarn Classic',
        lockfileName: 'yarn.lock',
        command: ['yarn', 'install', '--non-interactive', '--ignore-scripts'],
    },
    {
        ...JAVASCRIPT_PROJECT,
        name: 'pnpm',
        lockfileName: 'pnpm-lock.yaml',
        command: ['pnpm', 'install', '--lockfile-only', '--ignore-scripts'],
    },
    { ...PYTHON_PROJECT, name: 'uv', lockfileName: 'uv.lock', command: ['uv', 'lock'] },
] as const;
