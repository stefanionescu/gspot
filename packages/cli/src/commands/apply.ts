import { dirname } from 'node:path';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { TEMPORARY_FILE_NAME } from '#cli/config/repository/setup.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/folders.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';
import type { CommandLocation, CommandCompletion } from '#cli/types/commands/edits.ts';

async function runApplyCommand(root: string): Promise<CommandResult> {
    const session = await openSession(root);
    const writer = openFiles(root);
    const generated = buildGeneratedFiles(session);
    const folders = new Set(
        [...generated.files, ...generated.blocks, ...generated.managedKeys].map(({ path }) => dirname(path)),
    );
    for (const folder of folders) deleteStaleTemporaryPaths(writer, folder === '.' ? '' : folder, TEMPORARY_FILE_NAME);
    const report = await writeGeneratedFiles(session, generated, writer);
    return { text: formatApplyReport(report), json: report, exitCode: 0 };
}

/**
Register the apply command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
@param location the calling folder and the Git root validated before the action.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerApply(program: Command, onResult: CommandCompletion, location: CommandLocation): void {
    program
        .command('apply')
        .summary(COMMAND_HELP.apply.summary)
        .description(COMMAND_HELP.apply.description)
        .action(async () => {
            onResult(await runApplyCommand(location.root));
        });
}
