import { listIgnores } from '#cli/settings/scope-settings.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { TOOL_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';
import { OSV_SCANNER_NOTES } from '#cli/config/generation/settings/builders/osv-scanner.ts';

/**
 * Build osv-scanner.toml: a note on why the file exists, and the package ignores, reasons, and expiration dates.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns a note on why the file exists, and the package ignores, reasons, and expiration dates.
 */
export function buildOsvScannerFile(planned: PlannedToolFile): string {
    const entries = listIgnores(planned.scope.settings, 'dependencies/osv-scanner').filter(
        (entry) => entry.rule !== undefined && entry.paths.length === 0,
    );
    const vulnerabilities = entries.map((entry) => ({
        id: entry.rule,
        ...(entry.until ? { ignoreUntil: entry.until } : {}),
        reason: entry.reason,
    }));
    return [
        ...OSV_SCANNER_NOTES,
        stringifyToml(entries.length === 0 ? {} : { IgnoredVulns: vulnerabilities }, TOOL_FILE_TOML_FORMAT),
    ].join('\n');
}
