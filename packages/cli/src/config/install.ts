import { MISE_PROGRAM } from '#cli/config/tools/find.ts';
import { HOOKS_PATH_SETTING } from '#cli/config/repository/hooks.ts';

import {
    YARN_SETTINGS,
    NPM_TOOL_PROJECT_FILE,
    MISE_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

export const SAMPLE_HOOK_SUFFIX = '.sample';
export const SET_HOOKS_PATH = ['git', 'config', HOOKS_PATH_SETTING] as const;
export const UNSET_HOOKS_PATH = ['git', 'config', '--unset', HOOKS_PATH_SETTING] as const;
export const HOOK_COMMAND = 'gspot check --hook';
export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;
export const VALE_INSTALL_PREFIX = 'vale-';
export const VALE_STYLES_PATH_PATTERN = /^StylesPath[\t ]*=([^\r\n]*)$/gmu;
export const TOOL_PROJECT_INPUTS: ReadonlySet<string> = new Set([
    MISE_TOOL_PROJECT_FILE,
    NPM_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
    YARN_SETTINGS,
]);
export const MISE_TRUST_ARGUMENTS = [MISE_PROGRAM, 'trust', MISE_TOOL_PROJECT_FILE] as const;
export const MISE_INSTALL_ARGUMENTS = [MISE_PROGRAM, 'install'] as const;
