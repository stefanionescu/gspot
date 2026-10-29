import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup.ts';

export const SET_HOOKS_PATH = ['git', 'config', HOOKS_PATH_SETTING] as const;

export const UNSET_HOOKS_PATH = ['git', 'config', '--unset', HOOKS_PATH_SETTING] as const;

export const NO_GIT_STATUS = 'not installed: no Git repository';

export const NOT_INSTALLED_STATUS = 'not installed; run gspot install';

export const UNSET_HOOKS_NOTE = 'disabled hooks: unset core.hooksPath';

export const HOOK_COMMENT_LINE = /^\s*#/u;

export const HOOK_FOLDER_KINDS = new Set(['hooksPath', 'githooks', 'husky']);
