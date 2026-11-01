import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { type CommandLocation, type InstallCommandJson } from '#cli/types/commands/commands.ts';

import {
    TOOL_PROJECT_FILES,
    TOOL_PROJECTS_MESSAGE,
    TOOLS_INSTALLED_MESSAGE,
    INSTALLATION_STOPPED_MESSAGE,
} from '#cli/config/commands/edits.ts';

function hasOutdatedToolProjects(files: Files, generated: Generation): boolean {
    return [...TOOL_PROJECT_FILES].some((path) => {
        const file = generated.files.find((each) => each.path === path);
        const next = file === undefined ? undefined : { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE };
        return !isSameContents(files.read(path), next);
    });
}

async function runInstallCommand(root: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const session = await openSession(root, { cancelSignal });
    const generated = buildGeneratedFiles(session);
    const writer = openFiles(root);
    if (hasOutdatedToolProjects(writer, generated)) throw new GspotError('install', TOOL_PROJECTS_MESSAGE);
    const { installed, notes, steps } = await installTools(session, {
        writer,
        generated,
        checkTools: listHostCheckTools(session.configuredChecks),
    });
    const summary = installed.length === 0 ? TOOLS_INSTALLED_MESSAGE : installed.join('\n');
    return {
        text: `${[summary, ...notes].join('\n')}\n`,
        json: { summary, steps, notes },
        exitCode: 0,
    };
}

/**
Register the install command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
@param location the calling folder and the Git root validated before the action.
*/
export function registerInstall(program: Command, onResult: CommandCompletion, location: CommandLocation): void {
    program
        .command('install')
        .summary(COMMAND_HELP.install.summary)
        .description(COMMAND_HELP.install.description)
        .action(async () => {
            onResult(
                await runCancelableCommand(
                    (cancelSignal) => runInstallCommand(location.root, cancelSignal),
                    INSTALLATION_STOPPED_MESSAGE,
                ),
            );
        });
}
