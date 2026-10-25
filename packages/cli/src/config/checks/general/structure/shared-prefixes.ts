import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { FOREIGN_HOOK_FOLDERS } from '#cli/config/repository/setup.ts';

export const SPEC_SUFFIX = /\.spec$/u;

const MISE_HOOKS_PATH = '.mise/tasks/hook';

export const HOOK_FOLDERS = [GSPOT_PATHS.hooks, MISE_HOOKS_PATH, ...FOREIGN_HOOK_FOLDERS] as const;

export const INDEX_BASE_NAMES = new Set(['index', 'mod', '__init__']);

export const COMPANION_SUFFIX = /\.(?:test|spec|stories|story|module|styles?|mock|bench)$/u;
