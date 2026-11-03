import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { CommandResult } from '#cli/types/system.ts';
import type { CommandDefinition } from '#cli/types/commands/edits.ts';
import { listInstallNotes, formatApplyReport, writeEveryGeneratedFile } from '#cli/generation/write.ts';

async function runApplyCommand(root: string): Promise<CommandResult> {
    const session = await openSession(root);
    const { generated, report } = await writeEveryGeneratedFile(session, openFiles(root));
    report.notes.push(...(await listInstallNotes(session, generated, report)));
    return { text: formatApplyReport(report), json: report, exitCode: 0 };
}

export const APPLY_COMMAND: CommandDefinition = {
    name: 'apply',
    run: async (_arguments, _flags, { root }) => await runApplyCommand(root),
};
