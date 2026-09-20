import type { EngineInput } from '#types/run.ts';
// The Python structure checks, each one analysis of the integrity engine.
import type { Finding } from '#types/finding.ts';
import type { StructureReader } from '#types/pyproject.ts';
import { importCycles, singletons } from '#cli/structure/python/imports.ts';
import { functionsOf, pythonModules } from '#cli/structure/python/modules.ts';

import {
    exportsAtBottom,
    lazyExports,
    packageExports,
    privateBeforePublic,
    privatePrefixes,
} from '#cli/structure/python/exports.ts';
import {
    callThroughs,
    longFunctions,
    longModules,
    placeholderDocstrings,
    trivialFunctions,
} from '#cli/structure/python/functions.ts';

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
        const problems = read({ modules, functions: modules.flatMap((module) => functionsOf(module)) }, input);
        for (const module of modules) module.tree.delete();
        return problems.map((entry) => ({
            check: input.spec.name,
            file: entry.file,
            line: entry.line,
            rule: entry.rule,
            message: entry.text,
            fixable: false,
        }));
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
    'python-trivial-function': analysis(({ modules, functions }, input) =>
        trivialFunctions(modules, functions, names(input, 'structure.python.trivial_allowed')),
    ),
    'python-call-through': analysis(({ functions }) => callThroughs(functions)),
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
