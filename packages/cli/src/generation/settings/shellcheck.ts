import { listIgnoredRules } from '#cli/settings/scope-view.ts';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { SHELLCHECK_CHECKS, SHELLCHECK_OPTIONS, SHELLCHECK_ALL_LEVEL_CHECKS } from '#cli/config/generation/settings.ts';

/**
 * Build the ShellCheck file from the settings.
 *
 * @param context the tool file to build.
 * @returns the ShellCheck source-path and excluded-rule settings.
 */
function buildShellcheckFile(context: ToolFileContext): string {
    const level = context.level;

    const isAll = level === 'all';
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_CHECKS : [])];
    const disable = listIgnoredRules(context.selection, 'bash/shellcheck');
    return [
        ...SHELLCHECK_OPTIONS.map(([key, value]) => `${key}=${value}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}

export { buildShellcheckFile };
