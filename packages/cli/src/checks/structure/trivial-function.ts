import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks.ts';
import { DEFAULT_TRIVIAL_STATEMENTS } from '#cli/config/checks/structure.ts';
import { trivialFile, trivialFunctionText } from '#cli/checks/structure/statements.ts';

/**
 * Report shell functions and files at or below the executable statement threshold.
 * @param context the check context
 * @param scripts reads the parsed shell scripts once
 * @returns the findings
 */
export const trivialFunction: Analysis = async (context, scripts) => {
    const threshold = context.limit('trivial_statements', 'bash') ?? DEFAULT_TRIVIAL_STATEMENTS;
    const index = await scripts();
    const findings = index.files.flatMap((file) =>
        file.functions.flatMap((entry) =>
            entry.statements <= threshold
                ? [
                      context.report(
                          file.path,
                          entry.start,
                          'trivial-function',
                          trivialFunctionText(entry.name, entry.statements, threshold),
                      ),
                  ]
                : [],
        ),
    );
    for (const file of index.files) {
        const tree = await parseSource('bash', file.text, context.input);
        if (tree === null) throw new Error(`Cannot parse Bash source ${file.path}.`);
        try {
            if (trivialFile(tree.rootNode, 'bash', threshold))
                findings.push(
                    context.report(
                        file.path,
                        1,
                        'trivial-file',
                        'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                    ),
                );
        } finally {
            tree.delete();
        }
    }
    return findings;
};
