import { findingAt } from '#cli/checks/finding.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { type FixResult, type CheckResult } from '#cli/types/execution/check.ts';
import { emitSettings, parseTomlText, writeSettings, readSettingsFile } from '#cli/settings/file.ts';

/**
 * Compare gspot.toml with the section, value, and comment order gspot writes.
 * @param session the repository session.
 * @param planned the settings-layout check.
 * @returns a finding when the settings file differs from the order gspot writes.
 */
export function settingsFormat(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const { text } = readSettingsFile(session.root);
    const canonical = emitSettings(text, parseTomlText(text, SETTINGS_FILE, 'settings'));
    const findings =
        text === canonical
            ? []
            : [
                  findingAt(
                      planned,
                      { file: SETTINGS_FILE },
                      undefined,
                      'gspot.toml is not in standard order. Run gspot check --fix --only gspot/settings-format.',
                      {
                          help: planned.check.help,
                          fixable: true,
                      },
                  ),
              ];
    return Promise.resolve({
        ...emptyResult(planned),
        findings,
        status: findings.length === 0 ? 'passed' : 'failed',
        duration: performance.now() - started,
    });
}

/**
 * Format gspot.toml while holding the writer lock and checking that its contents did not change.
 * @param planned the selected settings-layout check.
 * @param root the real repository or disposable dry-run root.
 * @returns whether the settings bytes changed.
 */
export function fixSettingsFormat(planned: PlannedCheck, root: string): FixResult {
    using log = openOwnershipLog(root);
    const { text: previous, original } = readSettingsFile(root);
    const text = emitSettings(previous, parseTomlText(previous, SETTINGS_FILE, 'settings'));
    writeSettings(log, text, original);
    const changed = previous !== text;
    return {
        check: planned.check.name,
        status: changed ? 'changed' : 'unchanged',
        changed: changed ? [SETTINGS_FILE] : [],
    };
}
