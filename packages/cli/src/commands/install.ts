import { openSession } from '#cli/engine/session.ts';
import { EXIT_FINDINGS } from '#cli/config/engine.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { CommandDefinition, InstallCommandJson } from '#cli/types/commands/edits.ts';

import {
    TOOLS_CHANGED_MESSAGE,
    TOOLS_MISSING_MESSAGE,
    TOOLS_INSTALLED_MESSAGE,
    INSTALLATION_STOPPED_MESSAGE,
} from '#cli/config/commands/edits.ts';

async function runInstallCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const session = await openSession(root, { cancelSignal });
    const { installed, missing, notes, steps } = await installTools(session, {
        writer: openFiles(root),
        generated: { files: buildToolProjects(session) },
        checkTools: listHostCheckTools(session.configuredChecks),
    });
    const unchanged = missing.length === 0 ? TOOLS_INSTALLED_MESSAGE : TOOLS_MISSING_MESSAGE;
    const isUnchanged = installed.length === 0;
    return {
        text: `${[...(isUnchanged ? [unchanged] : installed), ...notes, ...missing].join('\n')}\n`,
        json: { summary: isUnchanged ? unchanged : TOOLS_CHANGED_MESSAGE, installed, steps, notes, missing },
        exitCode: missing.length === 0 ? 0 : EXIT_FINDINGS,
    };
}

export const INSTALL_COMMAND: CommandDefinition = {
    name: 'install',
    run: async (_arguments, _flags, { root }) =>
        await runCancelableCommand(
            (cancelSignal) => runInstallCommand(root, cancelSignal),
            INSTALLATION_STOPPED_MESSAGE,
        ),
};
