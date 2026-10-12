import { colors } from '#cli/terminal/print.ts';
import { expectedPaths } from '#cli/apply/stale.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { planDeletion } from '#cli/ownership/plans.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { type OwnershipLog } from '#cli/types/ownership.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { type InitPrepared } from '#cli/types/commands/init.ts';
import { type FileCopy } from '#cli/types/system/safe-folder.ts';
import { applyPlans, openOwnershipLog } from '#cli/ownership/log.ts';

// Deletes replaced files only when their bytes still match the plan.
function deleteReplacedFiles(
    log: OwnershipLog,
    removed: InitPrepared['deleted'],
    read: ReadonlyMap<string, FileCopy | undefined>,
): string[] {
    const kept: string[] = [];
    const plans = [];
    for (const entry of removed) {
        const expected = read.get(entry.path);
        if (expected === undefined) {
            kept.push(entry.path);
            continue;
        }
        const plan = planDeletion(log, entry.path, expected);
        plans.push(plan);
        const status = plan.status;
        if (status === 'preserved') kept.push(entry.path);
    }
    applyPlans(
        log,
        plans.filter((plan) => plan.status !== 'preserved'),
    );
    return kept;
}

/**
 * Write settings and generated files and delete the replaced tool files.
 * @param root the repository root
 * @param prepared what init prepared
 * @returns the lines to print
 */
export function writeInitFiles(root: string, prepared: InitPrepared): string[] {
    using log = openOwnershipLog(root);
    const { session, generated } = prepared;
    writeSettings(log, prepared.settingsText, prepared.read.get(SETTINGS_FILE));
    const destinations = expectedPaths(session, generated);
    const applied = writeGeneratedFiles(session, generated, log, { reviewedOriginals: prepared.read });
    const kept = deleteReplacedFiles(
        log,
        prepared.deleted.filter((entry) => !destinations.has(entry.path)),
        prepared.read,
    );
    applied.notes.push(...kept.map((path) => `kept ${path}: it changed after init read it`));
    const version = colors.dim(`gspot ${session.version}`);
    return ['written: gspot.toml, .gspot/', ...applied.notes, version, ''];
}
