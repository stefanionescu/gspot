import { GspotError } from '#cli/errors.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * Validate the captured settings file through the command reader.
 * @param input the selected check and repository files.
 * @returns the settings findings.
 */
export function settings(input: CheckInput): Finding[] {
    try {
        parseSettings(input.settingsFile.text, input.root);
        return [];
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'settings') throw error;
        return error.errors.map((message) => findingAt(input, { file: SETTINGS_FILE }, 'settings', message));
    }
}
