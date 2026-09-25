import type { EngineInput } from '#cli/checks/input.ts';
import { importCycles, singletons } from '#cli/checks/python/imports.ts';
import { functionsOf, pythonModules } from '#cli/checks/python/modules.ts';
import type { StructureReader } from '#cli/checks/python/types.ts';
import type { Finding } from '#cli/checks/result.ts';
import { trivialFile } from '#cli/checks/structure/statements.ts';

import {
    exportsAtBottom,
    lazyExports,
    packageExports,
    privateBeforePublic,
    privatePrefixes,
} from '#cli/checks/python/exports.ts';
import { longFunctions, longModules, placeholderDocstrings, trivialFunctions } from '#cli/checks/python/functions.ts';

const DEFAULT_FILE_LINES = 300;
const DEFAULT_FUNCTION_LINES = 60;
const DEFAULT_PACKAGE_EXPORTS = 20;

function names(input: EngineInput, key: string): Set<string> {
    const entries = (input.view.settings[key] as { names?: string[] }[] | undefined) ?? [];
    return new Set(entries.flatMap((entry) => entry.names ?? []));
}

function analysis(read: StructureReader): (input: EngineInput) => Promise<Finding[]> {
    return async (input) => {
        const modules = await pythonModules(input);
        try {
            const problems = read({ modules, functions: modules.flatMap(functionsOf) }, input);
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
    'python-file-length': analysis(({ modules }, input) =>
        longModules(modules, input.view.limit('file_lines', 'python') ?? DEFAULT_FILE_LINES),
    ),
    'python-function-length': analysis(({ modules, functions }, input) =>
        longFunctions(modules, functions, input.view.limit('function_lines', 'python') ?? DEFAULT_FUNCTION_LINES),
    ),
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
    'python-no-lazy-exports': analysis(({ modules }) => lazyExports(modules)),
    'python-package-exports': analysis(({ modules }, input) => {
        const ceiling = input.view.settings['structure.python.max_package_exports'];
        return packageExports(modules, typeof ceiling === 'number' ? ceiling : DEFAULT_PACKAGE_EXPORTS);
    }),
    'python-import-cycles': analysis(({ modules }) => importCycles(modules)),
    'python-no-singletons': analysis(({ modules }, input) =>
        singletons(modules, names(input, 'structure.python.singletons_allowed')),
    ),
};
