import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { exportedNames, visitPythonModules } from '#cli/parsers/python.ts';
import { DEFINITIONS, PACKAGE_FILE } from '#cli/config/checks/language/python.ts';

/**
 * In a module with __all__: every definition the list leaves out starts with an underscore, and the list holds no such name.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function privatePrefix(input: CheckInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
            const exported = exportedNames(module);
            if (exported === undefined) return [];
            const listed = new Set(exported.names);
            const unmarked = module.statements.flatMap((statement) => {
                const name = DEFINITIONS.has(statement.type) ? statement.childForFieldName('name')?.text : undefined;
                if (name === undefined || listed.has(name) || name.startsWith('_')) return [];
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
                .filter((name) => name.startsWith('_') && !name.startsWith('__'))
                .map((name) =>
                    findingAt(
                        input,
                        { file: module.path, line: exported.statement.startPosition.row + 1 },
                        'private-prefix',
                        `${name} is private by its name and public by __all__. Pick one.`,
                    ),
                );
            return [...unmarked, ...leaked];
        }),
    );
}

/**
 * Private definitions come before public ones, so a reader meets the parts before what is built from them.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function privateBeforePublic(input: CheckInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
            const names = module.statements.flatMap((statement) => {
                const name =
                    statement.type === 'function_definition' ? statement.childForFieldName('name')?.text : undefined;
                return name === undefined ? [] : [{ name, statement }];
            });
            const firstPublic = names.findIndex((entry) => !entry.name.startsWith('_'));
            if (firstPublic === -1) return [];
            return names
                .slice(firstPublic)
                .filter((entry) => entry.name.startsWith('_') && !entry.name.startsWith('__'))
                .map((entry) =>
                    findingAt(
                        input,
                        { file: module.path, line: entry.statement.startPosition.row + 1 },
                        'private-before-public',
                        `${entry.name} is private and sits below a public function. Private functions come first.`,
                    ),
                );
        }),
    );
}

/**
 * __all__ is the last statement of its module, apart from a main guard.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function exportsAtBottom(input: CheckInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
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
        }),
    );
}

/**
 * A package shows at most a ceiling of names in __all__.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function packageExports(input: CheckInput): Promise<Finding[]> {
    const ceiling = input.view.limit('package_exports', 'python');
    if (ceiling === undefined) return [];
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
            const exported = module.path.endsWith(PACKAGE_FILE) ? exportedNames(module) : undefined;
            if (exported === undefined || exported.names.length <= ceiling) return [];
            return [
                findingAt(
                    input,
                    { file: module.path, line: exported.statement.startPosition.row + 1 },
                    'package-exports',
                    `The package exports ${String(exported.names.length)} names, over the ceiling of ${String(ceiling)}. Split it.`,
                ),
            ];
        }),
    );
}

/**
 * The names in __all__ go shortest first, and alphabetically among names of one length.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function exportOrder(input: CheckInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
            const exported = exportedNames(module);
            if (exported === undefined) return [];
            const sorted = exported.names.toSorted(
                (left, right) => left.length - right.length || left.localeCompare(right),
            );
            if (sorted.every((name, order) => name === exported.names[order])) return [];
            return [
                findingAt(
                    input,
                    { file: module.path, line: exported.statement.startPosition.row + 1 },
                    'export-order',
                    `The names in __all__ go shortest first: ${sorted.join(', ')}.`,
                ),
            ];
        }),
    );
}
