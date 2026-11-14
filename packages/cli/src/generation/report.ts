import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readHooks } from '#cli/repository/setup/read.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import { isGspotPath } from '#cli/repository/files/ownership.ts';
import { GENERATED_FILE_NOUN } from '#cli/config/generation/setup.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';

import {
    CHANGE_LABEL_WIDTH,
    HOOKS_CHANGED_NOTE,
    TOOL_PROJECT_FILES,
    TOOLS_CHANGED_NOTE,
    STALE_LOCKFILE_NOTE,
} from '#cli/config/generation/files.ts';

export function listGeneratedChangeLines(report: ApplyReport): string[] {
    const lines: string[] = [];
    for (const [action, paths] of [
        ['wrote', report.written],
        ['updated', report.updated],
        ['removed', report.deleted],
    ] as const) {
        const gspotCount = paths.filter((path) => isGspotPath(path)).length;
        const label = action.padEnd(CHANGE_LABEL_WIDTH);
        if (gspotCount > 0) lines.push(`${label}${formatCount(gspotCount, GENERATED_FILE_NOUN)} in ${GSPOT_FOLDER}/`);
        lines.push(...paths.filter((path) => !isGspotPath(path)).map((path) => `${label}${path}`));
    }
    return lines;
}

export function formatApplyReport(report: ApplyReport): string {
    const lines = listGeneratedChangeLines(report);
    if (lines.length === 0) lines.push('Generated files: none changed.');
    lines.push(...report.notes.map((note) => `note     ${note}`));
    return `${lines.join('\n')}\n`;
}

export async function listInstallNotes(
    session: Session,
    generated: Generation,
    report: ApplyReport,
): Promise<string[]> {
    const notes: string[] = [];
    const { hooksPath } = await readHooks(session.repository);
    if (
        session.settings.hooks.enabled &&
        hooksPath !== GSPOT_PATHS.hooks &&
        [...report.deleted, ...report.written].some((path) => path.startsWith(`${GSPOT_PATHS.hooks}/`))
    )
        notes.push(HOOKS_CHANGED_NOTE);
    if (listStaleLockfiles(session, generated.files).length === 0) return notes;
    const hasToolChanges = report.written.some((path) => TOOL_PROJECT_FILES.includes(path));
    return [...notes, hasToolChanges ? TOOLS_CHANGED_NOTE : STALE_LOCKFILE_NOTE];
}
