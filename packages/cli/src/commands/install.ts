import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { GspotError } from '#cli/system/errors.ts';
import { generate } from '#cli/generation/generate.ts';
import type { Files } from '#cli/types/system/files.ts';
import { installTools } from '#cli/installers/install.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { TOOL_PROJECT_FILES } from '#cli/config/commands/install.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import type { InstallCommandJson } from '#cli/types/commands/install.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';

function hasOutdatedToolProjects(files: Files, generated: GenerationResult): boolean {
    return [...TOOL_PROJECT_FILES].some((path) => {
        const file = generated.files.find((each) => each.path === path);
        const next = file === undefined ? undefined : { bytes: Buffer.from(file.content), mode: OWNER_WRITABLE_FILE };
        return !isSameContents(files.read(path), next);
    });
}

async function runInstallCommand(cwd: string, cancelSignal: AbortSignal): Promise<CommandResult<InstallCommandJson>> {
    const root = readRepositoryRoot(cwd);
    const session = await openSession(root, { cancelSignal });
    const generated = generate(session);
    using writer = openWriter(root);
    if (hasOutdatedToolProjects(writer, generated))
        throw new GspotError('install', 'The tool projects in .gspot do not match gspot.toml. Run gspot apply first.');
    const { note, steps } = await installTools(session, writer, generated);
    return {
        text: `${note === '' ? 'No change: every tool is installed.' : note}\n`,
        json: { steps },
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
                    'Installation stopped before every tool was installed.',
                ),
            );
        });
}
