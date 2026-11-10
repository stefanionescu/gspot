import {
    FILES_CHANGED_MESSAGE,
    INSTALLATION_STOPPED_MESSAGE,
    TOOLS_CHANGED_MESSAGE,
    TOOLS_INSTALLED_MESSAGE,
    TOOLS_MISSING_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { openSession } from '#cli/engine/session.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { listGeneratedChangeLines, writeEveryGeneratedFile } from '#cli/generation/write.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition, InstallCommandJson } from '#cli/types/commands/edits.ts';
import type { CommandResult } from '#cli/types/system.ts';

async function runInstallCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const session = await openSession(root, { cancelSignal });
    const writer = openFiles(root);
    const { report } = await writeEveryGeneratedFile(session, writer);
    const { installed, missing, notes, steps } = await installTools(session, {
        writer,
        generated: { files: buildToolProjects(session) },
        checkTools: listHostCheckTools(session),
    });
    const changes = listGeneratedChangeLines(report);
    let summary = TOOLS_CHANGED_MESSAGE;
    if (installed.length === 0 && missing.length > 0) summary = TOOLS_MISSING_MESSAGE;
    else if (installed.length === 0) summary = changes.length === 0 ? TOOLS_INSTALLED_MESSAGE : FILES_CHANGED_MESSAGE;
    const allNotes = [...report.notes, ...notes];
    return {
        text: `${[...changes, ...(installed.length === 0 ? [summary] : installed), ...allNotes, ...missing].join('\n')}\n`,
        json: { ...report, summary, installed, steps, notes: allNotes, missing },
        exitCode: missing.length === 0 ? 0 : EXIT_FINDINGS,
    };
}

export const INSTALL_COMMAND: CommandDefinition = {
    name: 'install',
    run: async ({ root }) =>
        await runCancelableCommand(
            (cancelSignal) => runInstallCommand(root, cancelSignal),
            INSTALLATION_STOPPED_MESSAGE,
        ),
};
