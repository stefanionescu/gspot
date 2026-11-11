import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { buildScanReport, formatScanText } from '#cli/commands/scan/report.ts';
import { compareInstalledRules, readUserRules } from '#cli/commands/scan/rules.ts';
import {
    GIT_UNBORN_HEAD_ARGUMENTS,
    SCAN_LOCKFILE_MESSAGE,
    SCAN_NO_FILES_MESSAGE,
    SCAN_SETTINGS_MESSAGE,
    SCAN_STOPPED_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import { HOOKS_PATH_SETTING, SAMPLE_HOOK_SUFFIX } from '#cli/config/repository/setup.ts';
import { SET_HOOKS_PATH } from '#cli/config/tools/installers.ts';
import { linkEnvironments } from '#cli/engine/copies/dependencies.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import { readGitSetting, readGitText, readHooksFolder } from '#cli/repository/git/run.ts';
import { detectPackageManager } from '#cli/repository/javascript/package-manager.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText, measureFolder } from '#cli/system/files/reads.ts';
import { isInside } from '#cli/system/paths.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { compareText } from '#cli/system/text.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import type { ScanReport } from '#cli/types/commands/reports.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

const SCAN_LEFT_OUT_NEEDS = new Set(['build', 'project-code']);

function listCodeRunners(session: Session): string[] {
    const checks = session.scopes.flatMap((scope) => scope.configurations.flatMap(({ checks }) => checks));
    const running = checks.filter(({ needs }) => needs?.some((need) => SCAN_LEFT_OUT_NEEDS.has(need)) === true);
    return [...new Set(running.map(({ id }) => id))].toSorted(compareText);
}

async function copyGitFolderHooks(root: string, copyRoot: string): Promise<void> {
    const [source, target] = await Promise.all([readHooksFolder(root), readHooksFolder(copyRoot)]);
    if (statSync(source, { throwIfNoEntry: false })?.isDirectory() !== true) return;
    mkdirSync(target, { recursive: true });
    for (const name of readdirSync(source)) {
        const stat = statSync(join(source, name), { throwIfNoEntry: false });
        if (stat?.isFile() !== true || name.endsWith(SAMPLE_HOOK_SUFFIX)) continue;
        copyFileSync(join(source, name), join(target, name));
        chmodSync(join(target, name), stat.mode);
    }
}

/**
Give the copy the hooks that Git runs in the repository. The copy has a Git folder of its own, so without them the plan
of init names no hook of the repository. A hooks folder that core.hooksPath names holds its tracked files in the copy.
*/
async function copyHooks(root: string, copyRoot: string, cancelSignal: AbortSignal): Promise<void> {
    const hooksPath = await readGitSetting(root, HOOKS_PATH_SETTING);
    if (hooksPath === undefined) {
        await copyGitFolderHooks(root, copyRoot);
        return;
    }
    const local = relative(root, resolve(root, hooksPath));
    const copied = isInside(local) ? local : resolve(root, hooksPath);
    await readGitText(copyRoot, [...SET_HOOKS_PATH.slice(1), copied], { cancelSignal });
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

async function runScanCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<ScanReport>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SCAN_SETTINGS_MESSAGE);
    using copy = await copyRevision(root, { kind: 'index' }, cancelSignal);
    await copyHooks(root, copy.root, cancelSignal);
    // With no commit behind the index, Git counts every tracked file as staged, so the secret scan reads every file.
    await readGitText(copy.root, GIT_UNBORN_HEAD_ARGUMENTS, { cancelSignal });
    const planning = await planInit(copy.root, { cwd: copy.root });
    if (planning.detection.files.length === 0) throw new GspotError('arguments', SCAN_NO_FILES_MESSAGE);
    const userRules = await readUserRules(planning);
    await writeInitFiles(copy.root, { ...planning, pinPath: undefined });
    const session = {
        ...(await openSession(copy.root, { cancelSignal })),
        startRunner: planning.session.startRunner,
    };
    linkEnvironments(
        root,
        copy.root,
        session.scopes.map(({ path }) => path),
    );
    await installTools(session, {
        writer: openFiles(copy.root),
        generated: { files: buildToolProjects(session) },
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
