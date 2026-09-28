import { trivialFile } from '#cli/checks/structure/statements.ts';
import type { StructureReader } from '#cli/types/checks/python.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { importCycles, singletons } from '#cli/checks/python/imports.ts';
import { functionsOf, pythonModules } from '#cli/checks/python/modules.ts';
import { placeholderDocstrings, trivialFunctions } from '#cli/checks/python/functions.ts';
import { exportsAtBottom, packageExports, privateBeforePublic, privatePrefixes } from '#cli/checks/python/exports.ts';

import {
    DEFINITIONS,
    DEFAULT_FILE_LINES,
    DEFAULT_FUNCTION_LINES,
    DEFAULT_PACKAGE_EXPORTS,
} from '#cli/constants/checks/python.ts';

function codeLines(lines: string[], from: number, to: number): number {
    return lines.slice(from, to).filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
}

function analysis(read: StructureReader): (input: EngineInput) => Promise<Finding[]> {
    return async (input) => {
        const modules = await pythonModules(input);
        try {
            const problems = read({ modules, functions: modules.flatMap((module) => functionsOf(module)) }, input);
            return problems.map((entry) => ({
                check: input.spec.name,
                file: entry.file,
                line: entry.line,
                rule: entry.rule,
                message: entry.text,
                fixable: false,
            }));
        } finally {
            for (const module of modules) module.tree.delete();
        }
    };
}

/** The analyses by the name a manifest gives them. */
export const PYTHON_STRUCTURE: Record<string, (input: EngineInput) => Promise<Finding[]>> = {
    'python-file-length': analysis(({ modules }, input) => {
        const ceiling = input.view.limit('file_lines', 'python') ?? DEFAULT_FILE_LINES;
        return modules.flatMap((module) => {
            const count = codeLines(module.lines, 0, module.lines.length);
            return count <= ceiling
                ? []
                : [
                      {
                          file: module.path,
                          line: 1,
                          rule: 'file-lines',
                          text: `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`,
                      },
                  ];
        });
    }),
    'python-function-length': analysis(({ modules, functions }, input) => {
        const ceiling = input.view.limit('function_lines', 'python') ?? DEFAULT_FUNCTION_LINES;
        const lines = new Map(modules.map((module) => [module.path, module.lines]));
        return functions.flatMap((fn) => {
            const count = codeLines(lines.get(fn.path) ?? [], fn.node.startPosition.row, fn.node.endPosition.row + 1);
            return count <= ceiling
                ? []
                : [
                      {
                          file: fn.path,
                          line: fn.node.startPosition.row + 1,
                          rule: 'function-lines',
                          text: `${fn.name} holds ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                      },
                  ];
        });
    }),
    'python-trivial-function': analysis(({ functions, modules }, input) => {
        const threshold = input.view.limit('trivial_statements', 'python') ?? 2;
        return [
            ...trivialFunctions(functions, threshold),
            ...modules
                .filter((source) => trivialFile(source.tree.rootNode, 'python', threshold))
                .map((source) => ({
                    file: source.path,
                    line:
                        (source.tree.rootNode.namedChildren.find((node) => !node.type.includes('comment'))
                            ?.startPosition.row ?? 0) + 1,
                    rule: 'trivial-file',
                    text: 'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                })),
        ];
    }),
    'python-placeholder-docstring': analysis(({ functions }) => placeholderDocstrings(functions)),
    'python-private-prefix': analysis(({ modules }) => privatePrefixes(modules)),
    'python-private-before-public': analysis(({ modules }) => privateBeforePublic(modules)),
    'python-exports-at-bottom': analysis(({ modules }) => exportsAtBottom(modules)),
    'python-no-lazy-exports': analysis(({ modules }) =>
        modules.flatMap((module) =>
            module.statements
                .filter(
                    (statement) =>
                        DEFINITIONS.has(statement.type) && statement.childForFieldName('name')?.text === '__getattr__',
                )
                .map((statement) => ({
                    file: module.path,
                    line: statement.startPosition.row + 1,
                    rule: 'no-lazy-exports',
                    text: 'A module __getattr__ makes names appear at run time. Import and list them.',
                })),
        ),
    ),
    'python-package-exports': analysis(({ modules }, input) => {
        const ceiling = input.view.settings['structure.python.max_package_exports'];
        return packageExports(modules, typeof ceiling === 'number' ? ceiling : DEFAULT_PACKAGE_EXPORTS);
    }),
    'python-import-cycles': analysis(({ modules }) => importCycles(modules)),
    'python-no-singletons': analysis(({ modules }, input) => {
        const entries =
            (input.view.settings['structure.python.singletons_allowed'] as { names?: string[] }[] | undefined) ?? [];
        return singletons(modules, new Set(entries.flatMap((entry) => entry.names ?? [])));
    }),
};
