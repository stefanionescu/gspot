import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/execution/finding.ts';
import type { NameAllowance } from '#cli/types/policy/settings.ts';
import { CLASS_CALL } from '#cli/config/checks/language/python.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { assignmentOf, visitPythonModules } from '#cli/parsers/python/source.ts';

// A module variable that holds an object built from a class at import time, or undefined. A name in capitals is a constant.
function builtAtImport(statement: Node): string | undefined {
    const assignment = assignmentOf(statement);
    if (assignment === undefined) return undefined;
    const name = assignment.childForFieldName('left');
    if (name?.type !== 'identifier' || name.text === name.text.toUpperCase()) return undefined;
    const built = assignment.childForFieldName('right');
    return built?.type === 'call' && CLASS_CALL.test(built.text) ? name.text : undefined;
}

/**
 * Objects built when the module is imported: one shared instance that every importer gets and no test replaces.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function singletons(input: EngineInput): Promise<Finding[]> {
    const entries = (input.view.settings['structure.python.singletons_allowed'] as NameAllowance[] | undefined) ?? [];
    const allowed = new Set(entries.flatMap((entry) => entry.names ?? []));
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) =>
            module.statements.flatMap((statement) => {
                const name = builtAtImport(statement);
                if (name === undefined || allowed.has(name)) return [];
                return [
                    findingAt(
                        input,
                        { file: module.path, line: statement.startPosition.row + 1 },
                        'singleton',
                        `${name} is built when the module is imported, so every importer shares it. Build it where it is used, and pass it in.`,
                    ),
                ];
            }),
        ),
    );
}
