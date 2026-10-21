import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { getNodePlace, buildFinding } from '#cli/runs/finding.ts';
import { findDocstring, PYTHON_SOURCES } from '#cli/parsers/python.ts';
import { NON_WORD_RUN, PLACEHOLDERS } from '#cli/config/checks/python.ts';

/**
 * Reports Python docstrings that only repeat a name or placeholder.
 *
 * @param session the repository and its tools.
 * @param planned the scope Python files.
 * @returns the findings.
 */
export async function checkPythonPlaceholderDocstrings(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const parsed = await parseCached(
        { root: session.root, reads: session.reads, resources: session.resources, files: planned.files },
        PYTHON_SOURCES,
    );
    const { functions } = parsed;
    return functions.flatMap((definition) => {
        const text = findDocstring(definition.node);
        if (text === undefined) return [];
        const plain = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = plain === definition.name.toLowerCase().replaceAll('_', ' ').trim();
        if (plain !== '' && !isName && !PLACEHOLDERS.has(plain)) return [];
        return [
            buildFinding(
                planned,
                getNodePlace(definition.path, definition.node),
                'placeholder-docstring',
                `The docstring of ${definition.name} says nothing the name does not. Say what the function does, or for whom.`,
            ),
        ];
    });
}
