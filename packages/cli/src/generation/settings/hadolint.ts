import { stringify } from 'yaml';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { HADOLINT_RECOMMENDED_OFF, HADOLINT_FAILURE_THRESHOLD } from '#cli/config/generation/settings.ts';

/**
 * Build the Hadolint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Hadolint exclusions and trusted registry settings.
 */
function buildHadolintFile(context: ToolFileContext): string {
    const level = context.level;

    const isAll = level === 'all';
    const off = [...listIgnoredRules(context.selection, 'docker/hadolint'), ...(isAll ? [] : HADOLINT_RECOMMENDED_OFF)];
    const registries = getTable(context.selection.view, 'tools.hadolint').trusted_registries;
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 ? { ignored: off } : {}),
        ...(registries.length > 0 ? { trustedRegistries: registries } : {}),
    };
    return stringify(document);
}

export { buildHadolintFile };
