import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import { findingAt, byLengthThenName } from '#cli/checks/finding.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readPython, disposePython, exportedNames } from '#cli/parsers/python.ts';
import { INIT_PY, DEFINITIONS, DUNDER_PREFIX, PYTHON_PRIVATE_PREFIX } from '#cli/config/checks/language/python.ts';

/**
 * In a module with __all__: every definition the list leaves out starts with an underscore, and the list holds no such name.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonPrivatePrefix(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) => {
        const exported = exportedNames(module);
        if (exported === undefined) return [];
        const listed = new Set(exported.names);
        const unmarked = module.statements.flatMap((statement) => {
            const name = DEFINITIONS.has(statement.type) ? statement.childForFieldName('name')?.text : undefined;
            if (name === undefined || listed.has(name) || name.startsWith(PYTHON_PRIVATE_PREFIX)) return [];
            return [
                findingAt(
                    input,
                    { file: module.path, line: statement.startPosition.row + 1 },
                    'private-prefix',
                    `${name} is not in __all__. Rename it _${name}, or add it to __all__.`,
                ),
            ];
        });
        const leaked = exported.names
            .filter((name) => name.startsWith(PYTHON_PRIVATE_PREFIX) && !name.startsWith(DUNDER_PREFIX))
            .map((name) =>
                findingAt(
                    input,
                    { file: module.path, line: exported.statement.startPosition.row + 1 },
                    'private-prefix',
                    `${name} is private by its name and public by __all__. Pick one.`,
                ),
            );
        return [...unmarked, ...leaked];
    });
}

/**
 * Require __all__ as the module's last statement, apart from a main guard.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonExportsAtBottom(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) => {
        const exported = exportedNames(module);
        if (exported === undefined) return [];
        const after = module.statements.slice(module.statements.indexOf(exported.statement) + 1);
        const isLast = after.every(
            (statement) => statement.type === 'if_statement' && statement.text.includes('__main__'),
        );
        return isLast
            ? []
            : [
                  findingAt(
                      input,
                      { file: module.path, line: exported.statement.startPosition.row + 1 },
                      'exports-at-bottom',
                      'Move __all__ to the end of the module.',
                  ),
              ];
    });
}

/**
 * A package shows at most a limit of names in __all__.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonPackageExports(input: CheckInput): Promise<Finding[]> {
    const limit = input.selection.view.limit('index_exports');
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) => {
        const exported = module.path.endsWith(INIT_PY) ? exportedNames(module) : undefined;
        if (exported === undefined || exported.names.length <= limit) return [];
        return [
            findingAt(
                input,
                { file: module.path, line: exported.statement.startPosition.row + 1 },
                'package-exports',
                `The package exports ${String(exported.names.length)} names, over the limit of ${String(limit)}. Split it.`,
            ),
        ];
    });
}

/**
 * The names in __all__ go shortest first, and alphabetically among names of one length.
 * @param input the selected scope, files, and settings.
 * @returns the findings for that check.
 */
export async function pythonExportOrder(input: CheckInput): Promise<Finding[]> {
    const parsed = await visitParsed(input, readPython, disposePython, input.resources);
    const { modules } = parsed;
    return modules.flatMap((module) => {
        const exported = exportedNames(module);
        if (exported === undefined) return [];
        const sorted = exported.names.toSorted(byLengthThenName);
        if (sorted.every((name, order) => name === exported.names[order])) return [];
        return [
            findingAt(
                input,
                { file: module.path, line: exported.statement.startPosition.row + 1 },
                'export-order',
                `The names in __all__ go shortest first: ${sorted.join(', ')}.`,
            ),
        ];
    });
}
