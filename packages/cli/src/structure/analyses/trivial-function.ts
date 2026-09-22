import { parserFor } from '#cli/naming/parsers.ts';
import { trivialFile } from '#cli/structure/statements.ts';
import type { Analysis } from '#cli/structure/types.ts';

export const trivialFunction: Analysis = async (context, scripts) => {
    const threshold = context.limit('trivial_statements', 'bash') ?? 2;
    const index = await scripts();
    const findings = index.files.flatMap((file) =>
        file.functions.flatMap((entry) =>
            entry.statements <= threshold
                ? [
                      context.report(
                          file.path,
                          entry.start,
                          'trivial-function',
                          `${entry.name} has ${entry.statements} executable statements, at most ${threshold}. Inline it or suppress its required API with a reason.`,
                      ),
                  ]
                : [],
        ),
    );
    const parser = await parserFor('bash');
    for (const file of index.files) {
        const tree = parser.parse(file.text);
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
