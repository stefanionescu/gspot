// doctor: the report, or --settings.
import { openSession } from '#cli/run/session.ts';
import type { DoctorOptions } from '#types/doctor.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { settingRows } from '#cli/doctor/settings.ts';
import type { Session, CommandResult } from '#types/run.ts';
import { newerVersion } from '#cli/doctor/newer-version.ts';
import { doctorReport, doctorText } from '#cli/doctor/report.ts';
import { GSPOT_VERSION, pinnedVersion } from '#cli/run/version-pin.ts';

const KEY_GAP = 2;
const VALUE_WIDTH = 28;

function scopeTag(scope: string | undefined): string {
    return scope === undefined || scope === '' ? '' : `  [scope ${scope}]`;
}

function settingsText(session: Session): CommandResult {
    const { rows, extras } = settingRows(session);
    const width = Math.max(...rows.map((row) => row.key.length)) + KEY_GAP;
    const lines = rows.map((row) => {
        const value = (row.value === undefined ? 'unset' : JSON.stringify(row.value)).padEnd(VALUE_WIDTH);
        return `${row.key.padEnd(width)}${value} ${row.direction}  ${row.source}${scopeTag(row.scope)}`;
    });
    if (extras.length > 0) {
        lines.push('', 'not a slot');
        for (const extra of extras)
            lines.push(
                `  tools.${extra.tool}.extra  ${extra.keys.join(', ')}  ${extra.reason}${scopeTag(extra.scope)}`,
            );
    }
    return { text: `${lines.join('\n')}\n`, json: { settings: rows, extras }, exitCode: 0 };
}

/**
 * Runs doctor: the report, or every setting with its value and source under --settings.
 * @param options the parsed flags
 * @returns the command result
 */
export async function doctorCommand(options: DoctorOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.settings) return settingsText(session);
    const newer = options.offline ? undefined : await newerVersion(GSPOT_VERSION);
    const report = doctorReport(session, pinnedVersion(root), newer);
    return { text: doctorText(report), json: report, exitCode: report.exitCode };
}
