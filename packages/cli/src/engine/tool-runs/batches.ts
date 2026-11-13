import {
    BATCH_FILE,
    TOOL_ARGUMENTS_MESSAGE,
    UNIX_COMMAND_LIMIT,
    WINDOWS_ARGUMENT_OVERHEAD,
    WINDOWS_COMMAND_LIMIT,
    WINDOWS_ESCAPE_EXPANSION,
    WINDOWS_PROCESS_LIMIT,
    WINDOWS_QUOTES_LENGTH,
} from '#cli/config/engine.ts';
import { buildFileCommandLines, expandCommand } from '#cli/engine/tool-runs/placeholders.ts';
import { CheckStop } from '#cli/system/errors.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { CommandLine, Substitutions } from '#cli/types/engine/tool-runs.ts';

function selectCommandLimit(platform: NodeJS.Platform, { isBatchFile }: { isBatchFile: boolean }): number {
    if (platform !== 'win32') return UNIX_COMMAND_LIMIT;
    return isBatchFile ? WINDOWS_COMMAND_LIMIT : WINDOWS_PROCESS_LIMIT;
}

export function buildCommandLines(
    planned: PlannedCheck,
    expansion: { session: CheckSession; command: string[]; substitutions: Substitutions },
): CommandLine[] {
    const { session, command, substitutions } = expansion;
    const fixed = expandCommand(session, planned, command, { ...substitutions, files: [] });
    return splitFileArguments(
        substitutions.files,
        fixed.filter((argument) => typeof argument === 'string'),
        process.platform,
    ).flatMap((files) =>
        buildFileCommandLines(expandCommand(session, planned, command, { ...substitutions, files }), files),
    );
}

export function splitFileArguments(files: string[], fixed: string[], platform: NodeJS.Platform): string[][] {
    const isBatchFile = platform === 'win32' && BATCH_FILE.test(fixed[0] ?? '');
    const measure = (argument: string): number => {
        if (isBatchFile) return argument.length * WINDOWS_ESCAPE_EXPANSION + WINDOWS_ARGUMENT_OVERHEAD;
        return platform === 'win32' ? argument.length + WINDOWS_QUOTES_LENGTH : Buffer.byteLength(argument) + 1;
    };
    const limit = selectCommandLimit(platform, { isBatchFile });
    const budget = limit - fixed.reduce((size, argument) => size + measure(argument), 0);
    if (budget < 0) throw new CheckStop('error', TOOL_ARGUMENTS_MESSAGE);
    const batches: string[][] = [[]];
    let used = 0;
    const measured = files.map((file) => ({ file, size: measure(file) }));
    for (const { file, size } of measured) {
        if (size > budget) throw new CheckStop('error', `${file} is too long for one command line. Shorten its path.`);
        if (used + size > budget) {
            batches.push([]);
            used = 0;
        }
        (batches.at(-1) as string[]).push(file);
        used += size;
    }
    return batches;
}
