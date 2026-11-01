import { dirname } from 'node:path';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { TEMPORARY_FILE_NAME } from '#cli/config/repository/setup.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import { deleteStaleTemporaryPaths } from '#cli/system/files/folders.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';

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

export const applyCommand: CommandDefinition = {
    name: 'apply',
    run: async (_arguments, _flags, { root }) => await runApplyCommand(root),
};
