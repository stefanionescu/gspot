import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';

import {
    SHELLCHECK_CHECKS,
    SHELLCHECK_OPTIONS,
    SHELLCHECK_ALL_LEVEL_CHECKS,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the shellcheck configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.extra the authored additional tool options.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param level the selected check level.
 *
 * @returns the generated configuration text.
 */
export function shellcheckToolFile({ extra, rulesOff }: Pick<ScopeView, 'extra' | 'rulesOff'>, level: Level): string {
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
