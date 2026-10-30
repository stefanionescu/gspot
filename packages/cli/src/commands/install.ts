import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import { installTools } from '#cli/installers/install.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import type { InstallCommandJson } from '#cli/types/commands/install.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';

import {
    TOOL_PROJECT_FILES,
    TOOL_PROJECTS_MESSAGE,
    TOOLS_INSTALLED_MESSAGE,
    INSTALLATION_STOPPED_MESSAGE,
} from '#cli/config/commands/install.ts';

function hasOutdatedToolProjects(files: Files, generated: Generation): boolean {
    return [...TOOL_PROJECT_FILES].some((path) => {
        const file = generated.files.find((each) => each.path === path);
        const next = file === undefined ? undefined : { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE };
        return !isSameContents(files.read(path), next);
    });
}

async function runInstallCommand(cwd: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const root = await readRepositoryRoot(cwd);
    const session = await openSession(root, { cancelSignal });
    const generated = generateFiles(session);
    const writer = openFiles(root);
    if (hasOutdatedToolProjects(writer, generated)) throw new GspotError('install', TOOL_PROJECTS_MESSAGE);
    const { installed, notes, steps } = await installTools(session, writer, generated);
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
*/
export function registerInstall(program: Command, onResult: CommandCompletion): void {
    program
        .command('install')
        .summary(COMMAND_HELP.install.summary)
        .description(COMMAND_HELP.install.description)
        .action(async () => {
            onResult(
                await runCancelableCommand(
                    (cancelSignal) => runInstallCommand(process.cwd(), cancelSignal),
                    INSTALLATION_STOPPED_MESSAGE,
                ),
            );
        });
}
