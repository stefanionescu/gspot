import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';

export const GENERATOR_IGNORED_FOLDERS = [NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER] as const;

export const RULES = { stale: 'stale', missing: 'missing', untracked: 'untracked' } as const;
