import { stringify } from 'yaml';
import type { Level } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { ToolFileSource } from '#cli/types/generation/files.ts';
import { HADOLINT_RECOMMENDED_OFF, HADOLINT_FAILURE_THRESHOLD } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the hadolint configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 * @param root0.rulesOff the disabled lint rule reader.
 * @param level the selected check level.
 *
 * @returns the generated configuration text.
 */
export function hadolintToolFile(
    { settings, rulesOff }: Pick<ScopeView, 'settings' | 'rulesOff'>,
    level: Level,
): ToolFileSource {
    const isAll = level === 'all';
    const off = [...rulesOff('docker/hadolint'), ...(isAll ? [] : HADOLINT_RECOMMENDED_OFF)];
    const registries = settings['tools.hadolint.trusted_registries'] as string[];
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 ? { ignored: off } : {}),
        ...(registries.length > 0 ? { trustedRegistries: registries } : {}),
    };
    return { content: stringify(document).trimEnd(), document: document };
}
