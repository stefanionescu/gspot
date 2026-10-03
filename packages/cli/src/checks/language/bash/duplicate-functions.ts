import { findingAt } from '#cli/execution/finding.ts';
import { codeLines } from '#cli/checks/language/bash/code-lines.ts';
import { DUPLICATE_LINES } from '#cli/config/checks/language/bash.ts';
import type { ScriptFunction } from '#cli/types/checks/language/bash.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';

/**
 * Reports matching normalized function bodies that meet `limits.bash.duplicate_lines`.
 * @param context the check context
 * @param scripts the shell index
 * @returns the findings
 */
export const duplicateFunctions: Analysis = async (context, scripts) => {
    const minimum = context.limit('duplicate_lines', 'bash') ?? DUPLICATE_LINES;
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
            return findingAt(
                context.input,
                { file: first?.file ?? '', line: first?.line ?? 1 },
                'same-body',
                `These functions have the same body: ${places}.`,
            );
        })
        .toArray();
};
