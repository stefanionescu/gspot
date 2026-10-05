import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';

export const MISE_HOOK_DIRECTORY = '.mise/tasks/hook';

/** Hook scripts keep their runner's names, including scripts nested beneath these folders. */
export const HOOK_DIRECTORIES = [HOOKS_DIRECTORY, MISE_HOOK_DIRECTORY, '.githooks', '.husky', '.git-hooks'];
