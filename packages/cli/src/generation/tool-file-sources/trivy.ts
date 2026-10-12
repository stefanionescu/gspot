import { stringify } from 'yaml';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { TRIVY_SKIPPED_FOLDERS } from '#cli/config/generation/tool-file-sources.ts';
/**
 * Write the trivy configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.settings the validated settings.
 *
 * @returns the generated configuration text.
 */
export function trivyToolFile({ settings }: Pick<ScopeView, 'settings'>): string {
    return stringify({
        timeout: `${String(settings['tool_timeout_seconds'])}s`,
        severity: settings['tools.trivy.severity'],
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    }).trimEnd();
}
