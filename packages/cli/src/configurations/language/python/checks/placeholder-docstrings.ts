import {
    CLASS_DOCSTRING_OPENING,
    NON_WORD_RUN,
    PLACEHOLDERS,
    PYTHON_RULES,
} from '#cli/config/configurations/python.ts';
import { findDocstring, readPythonFiles } from '#cli/parsers/code/python.ts';
import { splitWords } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkPlaceholderDocstrings(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { functions, modules } = await readPythonFiles({
        cache: session.cache,
        resources: session.resources,
        files: planned.files,
    });
    const definitions = [
        ...functions,
        ...modules.flatMap(({ path, tree }) =>
            tree.rootNode
                .descendantsOfType('class_definition')
                .map((node) => ({ path, node, name: node.childForFieldName('name')?.text ?? '' })),
        ),
    ];
    return definitions.flatMap((definition) => {
        const text = findDocstring(definition.node);
        if (text === undefined) return [];
        const lowered = text.toLowerCase().replaceAll(NON_WORD_RUN, ' ').trim();
        const isName = lowered === splitWords(definition.name).join(' ');
        const isClassOpening = definition.node.type === 'class_definition' && CLASS_DOCSTRING_OPENING.test(lowered);
        if (lowered !== '' && !isName && !isClassOpening && !PLACEHOLDERS.has(lowered)) return [];
        return [
            {
                file: definition.path,
                line: definition.node.startPosition.row + 1,
                column: definition.node.startPosition.column + 1,
                rule: PYTHON_RULES.placeholderDocstring,
                message: `The docstring of ${definition.name} says nothing the name does not. Describe its purpose or behavior.`,
            },
        ];
    });
}

export const PLACEHOLDER_DOCSTRINGS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/placeholder-docstrings': { check: checkPlaceholderDocstrings },
};
