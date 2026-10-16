import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readPython, docstringOf, disposePython } from '#cli/parsers/python.ts';
import { NON_WORD_RUN, PLACEHOLDERS } from '#cli/config/checks/language/python.ts';

/**
 * Report Python docstrings that only repeat a name or placeholder.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonPlaceholderDocstrings(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { functions } = parsed;
    return functions.flatMap((definition) => {
        const text = docstringOf(definition.node);
        if (text === undefined) return [];
        const plain = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = plain === definition.name.toLowerCase().replaceAll('_', ' ').trim();
        if (plain !== '' && !isName && !PLACEHOLDERS.has(plain)) return [];
        return [
            findingAt(
                input,
                { file: definition.path, line: definition.node.startPosition.row + 1 },
                'placeholder-docstring',
                `The docstring of ${definition.name} says nothing the name does not. Say what the function does, or for whom.`,
            ),
        ];
    });
}
