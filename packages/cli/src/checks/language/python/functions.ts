import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { visitParsed } from '#cli/parsers/source/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { PLACEHOLDERS } from '#cli/config/checks/language/python.ts';
import { readPython, docstringOf, disposePython } from '#cli/parsers/source/contracts.ts';

/**
 * Report Python docstrings that only repeat a name or placeholder.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function placeholderDocstrings(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readPython, disposePython);
    const { functions } = parsed.value;
    return functions.flatMap((definition) => {
        const text = docstringOf(definition.node);
        if (text === undefined) return [];
        const plain = text
            .toLowerCase()
            .replaceAll(/[^a-z\d]+/gu, ' ')
            .trim();
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
