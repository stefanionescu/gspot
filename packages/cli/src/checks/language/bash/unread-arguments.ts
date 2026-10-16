import { buildFinding } from '#cli/checks/finding.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';

/**
 * One finding per function call with more arguments than the function reads.
 * @param input the check context.
 * @returns the findings.
 */
export async function checkBashUnreadArguments(input: CheckInput): Promise<Finding[]> {
    const index = await readScripts(input);
    const names = new Set(index.flatMap((file) => file.functions.map((entry) => entry.name)));
    const widest = new Map<string, number>();
    for (const file of index)
        for (const call of file.calls) {
            if (names.has(call.name)) widest.set(call.name, Math.max(widest.get(call.name) ?? 0, call.count));
        }
    return index.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const width = widest.get(entry.name) ?? 0;
            const highest = entry.highestRead;
            if (width <= highest) return [];
            const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
            const read = highest === 0 ? 'reads no positional parameter' : `reads none past $${String(highest)}`;
            const positions =
                unread.length === 1 ? `position ${unread.join('')} is` : `positions ${unread.join(' and ')} are`;
            return [
                buildFinding(
                    input,
                    { file: file.path, line: entry.start },
                    'unread-arguments',
                    `${entry.name} is called with up to ${String(width)} ${width === 1 ? 'argument' : 'arguments'} but ${read}: ${positions} never read.`,
                ),
            ];
        }),
    );
}
