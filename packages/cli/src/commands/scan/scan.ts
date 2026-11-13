import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildScanReport, formatScanText } from '#cli/commands/scan/report.ts';
import {
    GIT_UNBORN_HEAD_ARGUMENTS,
    SCAN_LEFT_OUT_NEEDS,
    SCAN_LOCKFILE_MESSAGE,
    SCAN_NO_FILES_MESSAGE,
    SCAN_SETTINGS_MESSAGE,
    SCAN_STOPPED_MESSAGE,
} from '#cli/config/commands/setup.ts';
import { LOCKFILES } from '#cli/config/parsers/projects.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { linkEnvironments } from '#cli/engine/copies/dependencies.ts';
import { copyHooks, copyRevision } from '#cli/engine/copies/revision.ts';
import { printProgress } from '#cli/engine/report.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { CHECK_GENERATION } from '#cli/generation/check-generation.ts';
import { compareInstalledRules, readUserRules } from '#cli/generation/setup/carryover/lint-rules.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import { readGitText } from '#cli/repository/git/run.ts';
import { detectPackageManager } from '#cli/repository/package-manager.ts';
import { GspotError } from '#cli/system/errors.ts';
import { measureFolder } from '#cli/system/files/folders.ts';
import { findText } from '#cli/system/files/reads.ts';
import { runCancelableCommand } from '#cli/system/processes/signals.ts';
import { rewriteProgress } from '#cli/system/terminal.ts';
import { compareText } from '#cli/system/text/order.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition, ScanReport } from '#cli/types/commands.ts';
import type { RunResult } from '#cli/types/engine/run.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function listCodeRunners(session: Session): string[] {
    const checks = session.scopes.flatMap((scope) => scope.configurations.flatMap(({ checks }) => checks));
    const running = checks.filter(({ needs }) => needs?.some((need) => SCAN_LEFT_OUT_NEEDS.has(need)) === true);
    return [...new Set(running.map(({ id }) => id))].toSorted(compareText);
}

/**
Name the lockfile that selects another package manager in the repository than in the copy. The copy holds the staged
files only, so a lockfile that Git does not track is missing there, and init reads it.
*/
function listUnstagedLockfileNotes(root: string, copyRoot: string): string[] {
    if (detectPackageManager(root, []).name === detectPackageManager(copyRoot, []).name) return [];
    return LOCKFILES.filter((row) => 'configuration' in row && row.configuration === 'javascript')
        .filter(({ file }) => existsSync(join(root, file)) && !existsSync(join(copyRoot, file)))
        .slice(0, 1)
        .map(({ file }) => SCAN_LOCKFILE_MESSAGE.replace('<lockfile>', () => file));
}

async function runEveryCheck(session: Session, skip: string[]): Promise<RunResult> {
    try {
        return await runChecks(session, {
            selectCheckCode,
            generation: CHECK_GENERATION,
            skip,
            stage: 'all',
            fix: false,
            cwd: session.root,
            pathArguments: [],
            onProgress: printProgress,
        });
    } finally {
        rewriteProgress('');
    }
}

async function runScanCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<ScanReport>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SCAN_SETTINGS_MESSAGE);
    using copy = await copyRevision(root, { kind: 'index' }, cancelSignal);
    await copyHooks(root, copy.root, cancelSignal);
    // With no commit behind the index, Git counts every tracked file as staged, so the secret scan reads every file.
    await readGitText(copy.root, GIT_UNBORN_HEAD_ARGUMENTS, { cancelSignal });
    const planning = await planInit(copy.root, {});
    if (planning.detection.files.length === 0) throw new GspotError('arguments', SCAN_NO_FILES_MESSAGE);
    const userRules = await readUserRules(planning);
    await writeInitFiles(copy.root, { ...planning, pinPath: undefined });
    const session = await openSession(copy.root, { cancelSignal, startRunner: planning.session.startRunner });
    linkEnvironments(
        root,
        copy.root,
        session.scopes.map(({ path }) => path),
    );
    await installTools(session, {
        checkTools: listHostCheckTools(session),
        runsProjectInstall: false,
    });
    const leftOut = listCodeRunners(session);
    const { report } = await runEveryCheck(session, leftOut);
    const toolBytes = measureFolder(join(copy.root, GSPOT_FOLDER));
    const ruleRows = await compareInstalledRules(copy.root, userRules);
    const built = buildScanReport({ planning, session, report, toolBytes, ruleRows, leftOut });
    const scan = { ...built, notRun: [...built.notRun, ...listUnstagedLockfileNotes(root, copy.root)] };
    return { text: formatScanText(scan), json: scan, exitCode: 0 };
}

export const SCAN_COMMAND: CommandDefinition<[]> = {
    name: 'scan',
    run: async ({ root }) =>
        await runCancelableCommand((cancelSignal) => runScanCommand(root, cancelSignal), SCAN_STOPPED_MESSAGE),
};
