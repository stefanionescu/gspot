import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { visitParsed } from '#cli/parsers/source/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { swiftFunctionName } from '#cli/parsers/swift/public.ts';
import type { CountedLanguage } from '#cli/types/parsers/statements.ts';
import { readHouseSources, disposeHouseSources } from '#cli/checks/general/structure/conventions.ts';
import { isDocstring, trivialText, isTrivialFile, executableStatements } from '#cli/parsers/source/contracts.ts';

// Native executable bodies exclude Python docstrings and Swift declarations without bodies.
function functionBody(node: Node, language: CountedLanguage): Node[] {
    const body = node.childForFieldName('body') ?? node;
    const siblings =
        language === 'swift'
            ? (body.namedChildren.find((child) => child.type === 'statements')?.namedChildren ?? [])
            : body.namedChildren;
    return siblings.filter(
        (child) => !child.type.includes('comment') && !(language === 'python' && isDocstring(child, siblings)),
    );
}

/**
 * Report trivial source functions and files while leaving anonymous expressions in place.
 * @param input the selected source files and their language-specific statement floors
 * @returns findings with the original statement counts and locations
 */
export async function trivialFunctions(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readHouseSources, disposeHouseSources);
    const files: Finding[] = [];
    const functions = parsed.value.flatMap((source) => {
        const threshold = input.view.limit('min_function_statements', source.language);
        if (threshold === undefined) return [];
        const findings = (source.captures.get('function') ?? []).flatMap((node) => {
            const body = functionBody(node, source.language);
            const count = executableStatements(body, source.language);
            return count > threshold
                ? []
                : [
                      findingAt(
                          input,
                          { file: source.path, line: node.startPosition.row + 1 },
                          'trivial-function',
                          trivialText(
                              source.language === 'swift'
                                  ? swiftFunctionName(node)
                                  : (node.childForFieldName('name')?.text ?? 'function'),
                              count,
                              threshold,
                          ),
                      ),
                  ];
        });
        if (isTrivialFile(source.tree.rootNode, source.language, threshold)) {
            const line =
                source.language === 'bash'
                    ? 1
                    : (source.tree.rootNode.namedChildren.find((node) => !node.type.includes('comment'))?.startPosition
                          .row ?? 0) + 1;
            files.push(
                findingAt(
                    input,
                    { file: source.path, line },
                    'trivial-file',
                    'This file contains only imports, aliases, forwarding, or trivial functions. Move them to their owner.',
                ),
            );
        }
        return findings;
    });
    return [...functions, ...files];
}
