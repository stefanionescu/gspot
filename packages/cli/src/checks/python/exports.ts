import type { Node } from 'web-tree-sitter';
import { exportedNames } from '#cli/checks/python/modules.ts';
import type { PythonModule } from '#cli/types/checks/python.ts';
import type { StructureProblem } from '#cli/types/checks/structure.ts';
import { DEFINITIONS, PACKAGE_FILE } from '#cli/constants/checks/python.ts';

function at(module: PythonModule, node: Node, rule: string, text: string): StructureProblem {
    return { file: module.path, line: node.startPosition.row + 1, rule, text };
}

/**
 * In a module with __all__: every definition the list leaves out starts with an underscore, and the list holds no such name.
 * @param modules every module of the run
 * @returns the problems
 */
export function privatePrefixes(modules: PythonModule[]): StructureProblem[] {
    return modules.flatMap((module) => {
        const exported = exportedNames(module);
        if (exported === undefined) return [];
        const listed = new Set(exported.names);
        const unmarked = module.statements
            .filter((statement) => {
                const name = DEFINITIONS.has(statement.type) ? statement.childForFieldName('name')?.text : undefined;
                return name !== undefined && !listed.has(name) && !name.startsWith('_');
            })
            .map((statement) =>
                at(
                    module,
                    statement,
                    'private-prefix',
                    `${(DEFINITIONS.has(statement.type) ? statement.childForFieldName('name')?.text : undefined) ?? ''} is not in __all__, so its name starts with an underscore.`,
                ),
            );
        const leaked = exported.names
            .filter((name) => name.startsWith('_') && !name.startsWith('__'))
            .map((name) =>
                at(
                    module,
                    exported.statement,
                    'private-prefix',
                    `${name} is private by its name and public by __all__. Pick one.`,
                ),
            );
        return [...unmarked, ...leaked];
    });
}

/**
 * Private definitions come before public ones, so a reader meets the parts before what is built from them.
 * @param modules every module of the run
 * @returns the problems
 */
export function privateBeforePublic(modules: PythonModule[]): StructureProblem[] {
    return modules.flatMap((module) => {
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
                at(
                    module,
                    entry.statement,
                    'private-before-public',
                    `${entry.name} is private and sits below a public function. Private functions come first.`,
                ),
            );
    });
}

/**
 * __all__ is the last statement of its module, apart from a main guard.
 * @param modules every module of the run
 * @returns the problems
 */
export function exportsAtBottom(modules: PythonModule[]): StructureProblem[] {
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
                  at(
                      module,
                      exported.statement,
                      'exports-at-bottom',
                      '__all__ is the last statement of the module, where a reader looks for it.',
                  ),
              ];
    });
}

/**
 * No module-level __getattr__: names that appear at import time hide from every reader and every tool.
 * @param modules every module of the run
 * @returns the problems
 */
export function lazyExports(modules: PythonModule[]): StructureProblem[] {
    return modules.flatMap((module) =>
        module.statements
            .filter(
                (statement) =>
                    (DEFINITIONS.has(statement.type) ? statement.childForFieldName('name')?.text : undefined) ===
                    '__getattr__',
            )
            .map((statement) =>
                at(
                    module,
                    statement,
                    'no-lazy-exports',
                    'A module __getattr__ makes names appear at run time. Import and list them.',
                ),
            ),
    );
}

/**
 * A package shows at most a ceiling of names in __all__.
 * @param modules every module of the run
 * @param ceiling the most names a package may export
 * @returns the problems
 */
export function packageExports(modules: PythonModule[], ceiling: number): StructureProblem[] {
    return modules.flatMap((module) => {
        const exported = module.path.endsWith(PACKAGE_FILE) ? exportedNames(module) : undefined;
        if (exported === undefined || exported.names.length <= ceiling) return [];
        return [
            at(
                module,
                exported.statement,
                'package-exports',
                `The package exports ${String(exported.names.length)} names, over the ceiling of ${String(ceiling)}. Split it.`,
            ),
        ];
    });
}
