import { codeLines } from '#cli/parsers/bash.ts';
import { findingAt } from '#cli/execution/finding.ts';
import type { Engine } from '#cli/types/execution/check.ts';
import type { ScriptFunction } from '#cli/types/parsers/bash.ts';
import { getScriptIndex } from '#cli/checks/language/bash/scripts.ts';
import type { FunctionLocation } from '#cli/types/checks/language/bash.ts';

/**
 * Reports matching normalized function bodies that meet `limits.bash.identical_function_lines`.
 * @param input the check context
 * @returns the findings
 */
export const duplicateFunctions: Engine = async (input) => {
    const minimum = input.view.limit('identical_function_lines', 'bash');
    if (minimum === undefined) return [];
    const index = await getScriptIndex(input);
    const groups = new Map<string, FunctionLocation[]>();
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
                input,
                { file: first?.file ?? '', line: first?.line ?? 1 },
                'same-body',
                `These functions have the same body: ${places}.`,
            );
        })
        .toArray();
};
