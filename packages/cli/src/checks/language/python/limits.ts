import { findingAt } from '#cli/execution/finding.ts';
import { visitPythonModules } from '#cli/parsers/python/source.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/**
 * Report Python files above the configured code-line ceiling.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function fileLines(input: EngineInput): Promise<Finding[]> {
    const ceiling = input.view.limit('file_lines', 'python');
    if (ceiling === undefined) return [];
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) => {
            const count = module.lines.filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
            return count <= ceiling
                ? []
                : [
                      findingAt(
                          input,
                          { file: module.path, line: 1 },
                          'file-lines',
                          `This file has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                      ),
                  ];
        }),
    );
}

/**
 * Report Python functions above the configured code-line ceiling.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function functionLines(input: EngineInput): Promise<Finding[]> {
    const ceiling = input.view.limit('function_lines', 'python');
    if (ceiling === undefined) return [];
    return visitPythonModules(input, ({ modules, functions }) => {
        const lines = new Map(modules.map((module) => [module.path, module.lines]));
        return functions.flatMap((definition) => {
            const count = (lines.get(definition.path) ?? [])
                .slice(definition.node.startPosition.row, definition.node.endPosition.row + 1)
                .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#')).length;
            return count <= ceiling
                ? []
                : [
                      findingAt(
                          input,
                          { file: definition.path, line: definition.node.startPosition.row + 1 },
                          'function-lines',
                          `${definition.name} has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`,
                      ),
                  ];
        });
    });
}
