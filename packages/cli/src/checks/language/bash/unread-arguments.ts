import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/check.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
/**
 * One finding per function that is called with more arguments than the positions it reads.
 * @param input the check context
 * @returns the findings
 */
export const unreadArguments: Engine = async (input) => {
    const index = await getScriptIndex(input);
    const names = new Set(index.files.flatMap((file) => file.functions.map((entry) => entry.name)));
    const widest = new Map<string, number>();
    for (const file of index.files)
        for (const call of file.calls) {
            if (names.has(call.name)) widest.set(call.name, Math.max(widest.get(call.name) ?? 0, call.count));
        }
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const width = widest.get(entry.name) ?? 0;
            const highest = entry.highestRead;
            if (width <= highest) return [];
            const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
            const read = highest === 0 ? 'reads no positional parameter' : `reads none past $${String(highest)}`;
            const positions =
                unread.length === 1 ? `position ${unread.join('')} is` : `positions ${unread.join(' and ')} are`;
            return [
                findingAt(
                    input,
                    { file: file.path, line: entry.start },
                    'unread-arguments',
                    `${entry.name} is called with up to ${String(width)} ${width === 1 ? 'argument' : 'arguments'} but ${read}: ${positions} never read.`,
                ),
            ];
        }),
    );
};
