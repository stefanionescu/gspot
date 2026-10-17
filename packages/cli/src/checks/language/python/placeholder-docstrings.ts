import { parseCached } from '#cli/system/files/cache.ts';
import { locateNode, buildFinding } from '#cli/checks/finding.ts';
import { findDocstring, PYTHON_SOURCES } from '#cli/parsers/python.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { NON_WORD_RUN, PLACEHOLDERS } from '#cli/config/checks/language/python.ts';

/**
 * Reports Python docstrings that only repeat a name or placeholder.
 * @param input the scope Python files.
 * @returns the findings.
 */
export async function checkPythonPlaceholderDocstrings(input: CheckInput): Promise<Finding[]> {
    const parsed = await parseCached(input, PYTHON_SOURCES);
    const { functions } = parsed;
    return functions.flatMap((definition) => {
        const text = findDocstring(definition.node);
        if (text === undefined) return [];
        const plain = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = plain === definition.name.toLowerCase().replaceAll('_', ' ').trim();
        if (plain !== '' && !isName && !PLACEHOLDERS.has(plain)) return [];
        return [
            buildFinding(
                input,
                locateNode(definition.path, definition.node),
                'placeholder-docstring',
                `The docstring of ${definition.name} says nothing the name does not. Say what the function does, or for whom.`,
            ),
        ];
    });
}
