import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';

import {
    SHELLCHECK_CHECKS,
    SHELLCHECK_OPTIONS,
    SHELLCHECK_ALL_LEVEL_ON,
} from '#cli/config/generation/settings/builders/shellcheck.ts';

/**
 * Build the ShellCheck file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the ShellCheck source-path and excluded-rule settings.
 */
export function buildShellcheckFile(planned: PlannedToolFile): string {
    const level = planned.level;

    const isAll = level === 'all';
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_ON : [])];
    const disable = listIgnoredRules(planned.selection, 'bash/shellcheck');
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}
