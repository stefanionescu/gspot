import { withoutComment } from '#cli/checks/structure/code-lines.ts';
import type { ScriptIndex, StructureAnalysis as Analysis } from '#cli/types/checks/structure.ts';
import { CALL, OPERATORS, FLOW_PREFIX, CALL_ENDINGS, POSITIONAL_PARAMETERS } from '#cli/constants/checks/structure.ts';

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

/**
 * One finding per function that is called with arguments somewhere but never reads a positional parameter.
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
            if (width === 0) return [];
            const code = entry.body.map((line) => withoutComment(line)).join('\n');
            if (POSITIONAL_PARAMETERS.some((pattern) => pattern.test(code))) return [];
            return [
                context.report(
                    file.path,
                    entry.start,
                    'unread-arguments',
                    `${entry.name} is called with up to ${String(width)} argument(s) but reads no positional parameter.`,
                ),
            ];
        }),
    );
};
