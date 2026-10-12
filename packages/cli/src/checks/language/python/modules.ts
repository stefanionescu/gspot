import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readPython, docstringOf, assignmentOf, disposePython } from '#cli/parsers/python.ts';
import { CLASS_CALL, DEFINITIONS, NON_WORD_RUN, PLACEHOLDERS } from '#cli/config/checks/language/python.ts';

// A module variable that holds an object built from a class at import time, or undefined. A name in capitals denotes a constant.
function builtAtImport(statement: Node): string | undefined {
    const assignment = assignmentOf(statement);
    if (assignment === undefined) return undefined;
    const name = assignment.childForFieldName('left');
    if (name?.type !== 'identifier' || name.text === name.text.toUpperCase()) return undefined;
    const built = assignment.childForFieldName('right');
    return built?.type === 'call' && CLASS_CALL.test(built.text) ? name.text : undefined;
}

/**
 * Report Python functions above the configured code-line limit.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonFunctionSize(input: CheckInput): Promise<Finding[]> {
    const limit = input.selection.view.limit('function_lines', 'python');
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules, functions } = parsed;
    const lines = new Map(modules.map((module) => [module.path, module.lines]));
    return functions.flatMap((definition) => {
        const count = (lines.get(definition.path) ?? [])
            .slice(definition.node.startPosition.row, definition.node.endPosition.row + 1)
            .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
        return count <= limit
            ? []
            : [
                  findingAt(
                      input,
                      { file: definition.path, line: definition.node.startPosition.row + 1 },
                      'function-lines',
                      `${definition.name} has ${String(count)} code lines, over the limit of ${String(limit)}.`,
                  ),
              ];
    });
}

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

/**
 * Report module __getattr__ definitions that expose names at run time.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonModuleGetattr(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) =>
        module.statements
            .filter(
                (statement) =>
                    DEFINITIONS.has(statement.type) && statement.childForFieldName('name')?.text === '__getattr__',
            )
            .map((statement) =>
                findingAt(
                    input,
                    { file: module.path, line: statement.startPosition.row + 1 },
                    'lazy-export',
                    'A module __getattr__ makes names appear at run time. Import and list them.',
                ),
            ),
    );
}

/**
 * Objects built at module import: one shared instance that every importer gets and no test replaces.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonSingletons(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) => {
        return module.statements.flatMap((statement) => {
            const name = builtAtImport(statement);
            if (name === undefined) return [];
            return [
                findingAt(
                    input,
                    { file: module.path, line: statement.startPosition.row + 1 },
                    'singleton',
                    `${name} is built when the module is imported, so every importer shares it. Build it where it is used, and pass it in.`,
                ),
            ];
        });
    });
}
