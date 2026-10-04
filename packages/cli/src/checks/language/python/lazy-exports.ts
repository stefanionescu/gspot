import { findingAt } from '#cli/execution/finding.ts';
import { visitPythonModules } from '#cli/parsers/python/source.ts';
import { DEFINITIONS } from '#cli/config/checks/language/python.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/**
 * Report module __getattr__ definitions that expose names at run time.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function lazyExports(input: EngineInput): Promise<Finding[]> {
    return visitPythonModules(input, ({ modules }) =>
        modules.flatMap((module) =>
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
        ),
    );
}
