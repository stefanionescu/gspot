import { FIXER_ERROR_PREFIX, UNCHANGED_FIX_MESSAGE } from '#cli/config/commands/check.ts';
import { printWarning } from '#cli/system/terminal.ts';
import { formatCount } from '#cli/system/text/messages.ts';
import type { FixReport } from '#cli/types/engine/run.ts';

export function printFailedFixers(fixes: FixReport, { verbose }: { verbose: boolean }): void {
    for (const result of fixes.results) {
        if (result.status !== 'failed') continue;
        const note = result.note;
        const detail =
            note
                .split('\n')
                .find((line) => FIXER_ERROR_PREFIX.test(line))
                ?.replace(FIXER_ERROR_PREFIX, '') ??
            note.split('\n', 1)[0] ??
            '';
        const failure = detail.endsWith('.') ? detail.slice(0, -1) : detail;
        const toolOutput = verbose
            ? `\n${note
                  .split('\n')
                  .map((line) => `  ${line}`)
                  .join('\n')}`
            : '';
        printWarning(`The ${result.check} fixer failed: ${failure}.${toolOutput}`);
    }
}

export function formatFixes(fixes: FixReport): string[] {
    const count = fixes.changed.length;
    if (count === 0 && fixes.broken.length === 0 && fixes.conflicted.length === 0) return [UNCHANGED_FIX_MESSAGE];
    return [
        ...(count === 0
            ? []
            : [`Fixed ${formatCount(count, 'file')}: ${fixes.changed.join(', ')}. The changes are not staged.`]),
        ...fixes.broken.map(
            (path) => `The fixers left a syntax error in ${path}; gspot put back the file as it was before the fixers.`,
        ),
        ...fixes.conflicted.map((path) => `The fixers skipped ${path}, because it holds merge-conflict markers.`),
    ];
}
