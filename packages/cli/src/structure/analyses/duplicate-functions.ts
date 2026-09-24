// Two shell functions with the same body. Searched: jscpd (no shell grammar), shellcheck; neither compares functions.
import { codeLines } from '#cli/structure/code-lines.ts';
import type { Analysis, ScriptFunction } from '#cli/types/structure.ts';

const DEFAULT_MIN_LINES = 3;

/**
 * One finding per group of functions whose normalized bodies match, at or above limits.bash.duplicate_min_lines.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const duplicateFunctions: Analysis = async (context, scripts) => {
    const minimum = context.limit('duplicate_min_lines', 'bash') ?? DEFAULT_MIN_LINES;
    const index = await scripts();
    const groups = new Map<string, { file: string; name: string; line: number }[]>();
    const add = (file: string, entry: ScriptFunction): void => {
        const lines = codeLines(entry.body).map((line) => line.code.replaceAll(/\s+/gu, ' '));
        if (entry.name === 'main' || lines.length < minimum) return;
        const key = lines.join('\n');
        const group = groups.get(key) ?? [];
        group.push({ file, name: entry.name, line: entry.start });
        groups.set(key, group);
    };
    for (const file of index.files) for (const entry of file.functions) add(file.path, entry);
    return groups
        .values()
        .filter((group) => group.length > 1)
        .map((group) => {
            const [first] = group;
            const places = group.map((entry) => `${entry.file}:${String(entry.line)} (${entry.name})`).join(', ');
            return context.report(
                first?.file ?? '',
                first?.line ?? 1,
                'same-body',
                `These functions have the same body: ${places}.`,
            );
        })
        .toArray();
};
