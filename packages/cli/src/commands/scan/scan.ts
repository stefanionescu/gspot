import { join } from 'node:path';

import { buildScanReport, formatScanText } from '#cli/commands/scan/report.ts';
import { compareInstalledRules, readUserRules } from '#cli/commands/scan/rules.ts';
import {
    GIT_UNBORN_HEAD_ARGUMENTS,
    SCAN_SETTINGS_MESSAGE,
    SCAN_STOPPED_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { linkEnvironments } from '#cli/engine/copies/dependencies.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import { readGitText } from '#cli/repository/git/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText, measureFolder } from '#cli/system/files/reads.ts';
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

async function runScanCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<ScanReport>> {
    if (findText(root, SETTINGS_FILE) !== undefined) throw new GspotError('arguments', SCAN_SETTINGS_MESSAGE);
    using copy = await copyRevision(root, { kind: 'index' }, cancelSignal);
    // With no commit behind the index, Git counts every tracked file as staged, so the secret scan reads every file.
    await readGitText(copy.root, GIT_UNBORN_HEAD_ARGUMENTS, { cancelSignal });
    const planning = await planInit(copy.root, { cwd: copy.root });
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
        checkTools: listHostCheckTools(session.configuredChecks),
        runsProjectInstall: false,
    });
    const leftOut = listCodeRunners(session);
    const { report } = await runEveryCheck(session, undefined, leftOut);
    const toolBytes = measureFolder(join(copy.root, GSPOT_FOLDER));
    const ruleRows = await compareInstalledRules(copy.root, userRules);
    const scan = buildScanReport({ planning, session, report, toolBytes, ruleRows, leftOut });
    return { text: formatScanText(scan), json: scan, exitCode: 0 };
}

export const SCAN_COMMAND: CommandDefinition<[]> = {
    name: 'scan',
    run: async ({ root }) =>
        await runCancelableCommand((cancelSignal) => runScanCommand(root, cancelSignal), SCAN_STOPPED_MESSAGE),
};
