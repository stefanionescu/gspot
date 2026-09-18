// doctor: the report, or --settings.
import { doctorReport, renderDoctor } from '#cli/doctor/report.ts';
import { newerVersion } from '#cli/doctor/newer-version.ts';
import { settingRows } from '#cli/doctor/settings.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import type { CommandResult } from '#cli/run/check.ts';
import { openSession } from '#cli/run/session.ts';
import { GSPOT_VERSION, pinnedVersion } from '#cli/run/version-pin.ts';

function pad(text: string, width: number): string {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

/** Runs doctor. */
export async function doctorCommand(options: {
    cwd: string;
    settings: boolean;
    offline: boolean;
}): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.settings) {
        const { rows, extras } = settingRows(session);
        const width = Math.max(...rows.map((row) => row.key.length)) + 2;
        const lines: string[] = [];
        for (const row of rows)
            lines.push(
                `${pad(row.key, width)}${pad(JSON.stringify(row.value) ?? 'unset', 28)} ${row.direction}  ${row.source}${row.scope ? `  [scope ${row.scope}]` : ''}`,
            );
        if (extras.length > 0) {
            lines.push('', 'not a slot');
            for (const extra of extras)
                lines.push(
                    `  tools.${extra.tool}.extra  ${extra.keys.join(', ')}  ${extra.reason}${extra.scope ? `  [scope ${extra.scope}]` : ''}`,
                );
        }
        return { text: `${lines.join('\n')}\n`, json: { settings: rows, extras }, exitCode: 0 };
    }
    const newer = options.offline ? undefined : await newerVersion(GSPOT_VERSION);
    const report = doctorReport(session, pinnedVersion(root), newer);
    return { text: renderDoctor(report), json: report, exitCode: report.exitCode };
}
