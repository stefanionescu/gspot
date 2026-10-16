import { stringify } from 'yaml';
import type { ToolFileContext } from '#cli/types/generation/files.ts';
import { HADOLINT_RECOMMENDED_OFF, HADOLINT_FAILURE_THRESHOLD } from '#cli/config/generation/tool-files.ts';

/**
 * Build hadolint file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the Hadolint exclusions and trusted registry settings.
 */
function buildHadolintFile(context: ToolFileContext): string {
    const { settings, rulesOff } = context.selection.view;
    const level = context.level;

    const isAll = level === 'all';
    const off = [...rulesOff('docker/hadolint'), ...(isAll ? [] : HADOLINT_RECOMMENDED_OFF)];
    const registries = settings['tools.hadolint.trusted_registries'] as string[];
    const document = {
        'failure-threshold': HADOLINT_FAILURE_THRESHOLD,
        ...(off.length > 0 ? { ignored: off } : {}),
        ...(registries.length > 0 ? { trustedRegistries: registries } : {}),
    };
    return stringify(document).trimEnd();
}

export { buildHadolintFile };
