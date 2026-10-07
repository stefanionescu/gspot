import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readPython, disposePython } from '#cli/parsers/python.ts';
import { DEFINITIONS } from '#cli/config/checks/language/python.ts';

/**
 * Report module __getattr__ definitions that expose names at run time.
 * @param input the selected scope, files, and policy settings
 * @returns the findings for that check
 */
export async function lazyExports(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readPython, disposePython);
    const { modules } = parsed.value;
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
