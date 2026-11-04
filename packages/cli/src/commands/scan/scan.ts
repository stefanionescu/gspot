import { join } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readGitText } from '#cli/repository/git/run.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { runEveryCheck } from '#cli/generation/checks.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import { findText, measureFolder } from '#cli/system/files/reads.ts';
import { linkEnvironments } from '#cli/engine/copies/dependencies.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import { planInit, writeInitFiles } from '#cli/generation/setup/planner.ts';
import type { ScanFlags, ScanReport } from '#cli/types/commands/reports.ts';
import { readUserRules, compareInstalledRules } from '#cli/commands/scan/rules.ts';
import { formatScanText, buildScanReport, formatScanMarkdown } from '#cli/commands/scan/report.ts';

import {
    MARKDOWN_FLAG,
    SCAN_STOPPED_MESSAGE,
    SCAN_SETTINGS_MESSAGE,
    GIT_UNBORN_HEAD_ARGUMENTS,
} from '#cli/config/commands/reports.ts';

async function runScanCommand(
    root: string,
    flags: ScanFlags,
    cancelSignal: AbortSignal,
): Promise<CommandResult<ScanReport>> {
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
    });
    const { report } = await runEveryCheck(session);
    const toolBytes = measureFolder(join(copy.root, GSPOT_FOLDER));
    const ruleRows = await compareInstalledRules(copy.root, userRules);
    const scan = buildScanReport({ planning, session, report, toolBytes, ruleRows });
    return { text: flags.markdown === true ? formatScanMarkdown(scan) : formatScanText(scan), json: scan, exitCode: 0 };
}

export const SCAN_COMMAND: CommandDefinition<[], ScanFlags> = {
    name: 'scan',
    options: [{ flags: MARKDOWN_FLAG }],
    run: async ({ flags, root }) => {
        if (flags.markdown === true && flags.json === true)
            throw new GspotError('arguments', '--markdown cannot run with --json. Choose one format.');
        return await runCancelableCommand(
            (cancelSignal) => runScanCommand(root, flags, cancelSignal),
            SCAN_STOPPED_MESSAGE,
        );
    },
};
