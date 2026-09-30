import { findingAt } from '#cli/checks/result.ts';
import { withoutComment } from '#cli/checks/structure/code-lines.ts';
import type { ScriptIndex, StructureAnalysis as Analysis } from '#cli/types/checks.ts';

import {
    CALL,
    OPERATORS,
    FLOW_PREFIX,
    CALL_ENDINGS,
    ALL_PARAMETERS,
    POSITIONAL_READ,
} from '#cli/config/checks/structure.ts';

function argumentCount(rest: string): number {
    const cut = OPERATORS.map((token) => rest.indexOf(token)).filter((position) => position >= 0);
    const truncated = (cut.length === 0 ? rest : rest.slice(0, Math.min(...cut))).trim();
    let count = 0;
    for (const word of truncated.split(/\s+/u)) {
        if (word === '') continue;
        if (CALL_ENDINGS.includes(word)) break;
        count += 1;
    }
    return count;
}

function callOn(line: string, names: Set<string>): { name: string; count: number } | undefined {
    let code = withoutComment(line).trim();
    while (FLOW_PREFIX.test(code)) code = code.replace(FLOW_PREFIX, '');
    const match = CALL.exec(code);
    const name = match?.[1];
    const rest = match?.[2] ?? '';
    // Function declarations and assignments are not calls.
    if (name === undefined || !names.has(name) || /^[=(]/u.test(rest.trimStart())) return undefined;
    return { name, count: argumentCount(rest) };
}

function widestCalls(index: ScriptIndex, names: Set<string>): Map<string, number> {
    const widest = new Map<string, number>();
    for (const file of index.files) {
        for (const line of file.lines) {
            const call = callOn(line, names);
            if (call !== undefined) widest.set(call.name, Math.max(widest.get(call.name) ?? 0, call.count));
        }
    }
    return widest;
}

// The highest position a body reads, or infinity once it reads them all.
function highestRead(code: string): number {
    if (ALL_PARAMETERS.test(code)) return Number.POSITIVE_INFINITY;
    return Math.max(0, ...[...code.matchAll(POSITIONAL_READ)].map((match) => Number(match.groups?.['position'])));
}

/**
 * One finding per function that is called with more arguments than the positions it reads.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const deadParameters: Analysis = async (context, scripts) => {
    const index = await scripts();
    const names = new Set(index.files.flatMap((file) => file.functions.map((entry) => entry.name)));
    const widest = widestCalls(index, names);
    return index.files.flatMap((file) =>
        file.functions.flatMap((entry) => {
            const width = widest.get(entry.name) ?? 0;
            const highest = highestRead(entry.body.map((line) => withoutComment(line)).join('\n'));
            if (width <= highest) return [];
            const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
            const read = highest === 0 ? 'reads no positional parameter' : `reads none past $${String(highest)}`;
            return [
                findingAt(
                    context.input,
                    { file: file.path, line: entry.start },
                    'unread-arguments',
                    `${entry.name} is called with up to ${String(width)} argument(s) but ${read}: position ${unread.join(', ')} is never read.`,
                ),
            ];
        }),
    );
};
