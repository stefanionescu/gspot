export const COPY_CONCURRENCY = 8;

export const WRITE_BATCH = 64;

export const LOCKS = ['package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'Package.resolved'];

export const PACKAGE_INPUTS = new Set(['package.json', 'pyproject.toml', 'Package.swift', ...LOCKS]);

export const CLONE_OPTIONS = { recursive: true, verbatimSymlinks: true } as const;

export const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];

export const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

/** A project manifest marks a folder whose installed dependencies a scratch copy carries. */
export const PROJECT_MANIFESTS = ['package.json', 'pyproject.toml'];
