import { findingAt } from '#cli/execution/finding.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { TRIVIAL_STATEMENTS } from '#cli/config/checks/language/language.ts';
import type { StructureAnalysis as Analysis } from '#cli/types/checks/checks.ts';
import { trivialFile, trivialText } from '#cli/checks/general/structure/statements.ts';

/**
 * Report shell functions and files at or below the executable statement threshold.
 * @param context the check context
 * @param scripts reads the parsed shell scripts once
 * @returns the findings
 */
export const trivialFunctions: Analysis = async (context, scripts) => {
    const threshold = context.limit('trivial_statements', 'bash') ?? TRIVIAL_STATEMENTS;
    const index = await scripts();
    const findings = index.files.flatMap((file) =>
        file.functions.flatMap((entry) =>
            entry.statements <= threshold
                ? [
                      findingAt(
                          context.input,
                          { file: file.path, line: entry.start },
                          'trivial-function',
                          trivialText(entry.name, entry.statements, threshold),
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
                    findingAt(
                        context.input,
                        { file: file.path, line: 1 },
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
