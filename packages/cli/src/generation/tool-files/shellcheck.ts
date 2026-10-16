import type { ToolFileContext } from '#cli/types/generation/files.ts';

import {
    SHELLCHECK_CHECKS,
    SHELLCHECK_OPTIONS,
    SHELLCHECK_ALL_LEVEL_CHECKS,
} from '#cli/config/generation/tool-file-sources.ts';
/**
 * Build shellcheck file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the ShellCheck source-path and excluded-rule settings.
 */
function buildShellcheckFile(context: ToolFileContext): string {
    const { extra, rulesOff } = context.selection.view;
    const level = context.level;

    const isAll = level === 'all';
    const native = extra('shellcheck');
    const options = [...SHELLCHECK_OPTIONS, ...(native === undefined ? [] : Object.entries(native))];
    const enable = [...SHELLCHECK_CHECKS, ...(isAll ? SHELLCHECK_ALL_LEVEL_CHECKS : [])];
    const disable = rulesOff('bash/shellcheck');
    return [
        ...options.map(([key, value]) => `${key}=${String(value)}`),
        `enable=${enable.join(',')}`,
        ...(disable.length > 0 ? [`disable=${disable.join(',')}`] : []),
    ].join('\n');
}

export { buildShellcheckFile };
