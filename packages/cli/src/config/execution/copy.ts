import { POLICY_FILE } from '#cli/config/platform/locations.ts';

export const WRITE_BATCH = 64;

export const CLONE_OPTIONS = { recursive: true, verbatimSymlinks: true } as const;

export const SCRATCH_EXTRAS = [POLICY_FILE, 'package.json', 'tsconfig.json', 'pyproject.toml'];

export const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];

/** A project manifest marks a folder whose installed dependencies a scratch copy carries. */
export const PACKAGE_MANIFESTS = ['package.json', 'pyproject.toml'];
