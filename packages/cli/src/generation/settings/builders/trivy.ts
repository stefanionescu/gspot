import { stringify as stringifyYaml } from 'yaml';
import { getTable } from '#cli/settings/scope-view.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { TRIVY_SKIPPED_FOLDERS } from '#cli/config/generation/settings/builders/trivy.ts';

/**
 * Build the Trivy file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Trivy severity, timeout, and skipped folders as YAML.
 */
export function buildTrivyFile(planned: PlannedToolFile): string {
    return stringifyYaml({
        timeout: `${String(planned.session.settingsFile.settings.tool_timeout_seconds)}s`,
        severity: getTable(planned.selection.view, 'tools.trivy').severity,
        scan: { 'skip-dirs': TRIVY_SKIPPED_FOLDERS },
    });
}
