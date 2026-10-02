import { pathMatcher } from '#cli/repository/selectors.ts';
import { visibilityOf } from '#cli/checks/language/swift/sources.ts';
import type { SwiftSource, StructureProblem } from '#cli/types/checks.ts';
import { COMMENTS, DIRECTIVE, FILE_LOCAL, DECLARATIONS, ENVIRONMENT_READ } from '#cli/config/checks/swift.ts';
/**
 * Top-level declarations that are private or fileprivate and sit below one that other files see.
 * @param sources every source of the run
 * @returns the problems
 */
export function privateBeforePublic(sources: SwiftSource[]): StructureProblem[] {
    return sources.flatMap((source) => {
        const declarations = source.tree.rootNode.namedChildren.filter((child) => DECLARATIONS.has(child.type));
        const firstShared = declarations.findIndex((node) => !FILE_LOCAL.has(visibilityOf(node)));
        if (firstShared === -1) return [];
        return declarations
            .slice(firstShared + 1)
            .filter((node) => FILE_LOCAL.has(visibilityOf(node)))
            .map((node) => {
                // An extension names the type it extends, so identify the extension itself in the finding.
                const name = node.childForFieldName('name')?.text ?? 'This declaration';
                const title =
                    node.childForFieldName('declaration_kind')?.text === 'extension'
                        ? `The extension of ${name}`
                        : name;
                return {
                    file: source.path,
                    line: node.startPosition.row + 1,
                    rule: 'private-below-shared',
                    text: `${title} is ${visibilityOf(node)} and sits below a declaration other files see. File-local declarations come first.`,
                };
            });
    });
}

/**
 * Reports process environment reads outside their declared owner. Without a declared owner, a single reading file owns the environment.
 * Multiple reading files without a declared owner all produce findings.
 * @param sources every source of the run.
 * @param owners the paths architecture.roles.env names.
 * @returns the problems.
 */
export function environmentReads(sources: SwiftSource[], owners: string[]): StructureProblem[] {
    const isOwner = pathMatcher(owners);
    const readers = sources.filter(
        (source) =>
            !isOwner(source.path) &&
            source.lines.flatMap((line, index) =>
                line.includes(ENVIRONMENT_READ) && !line.trimStart().startsWith('//') ? [index + 1] : [],
            ).length > 0,
    );
    if (owners.length === 0 && readers.length <= 1) return [];
    const text =
        owners.length === 0
            ? `${String(readers.length)} files read the process environment and the policy names no owner. Name one under architecture.roles.env and read it there.`
            : 'The process environment is read here, outside the environment owner. Read it there and pass the value in.';
    return readers.flatMap((source) =>
        source.lines
            .flatMap((line, index) =>
                line.includes(ENVIRONMENT_READ) && !line.trimStart().startsWith('//') ? [index + 1] : [],
            )
            .map((line) => ({ file: source.path, line, rule: 'read-outside-owner', text })),
    );
}

/**
 * Comments written among a file's imports, from the first import to the last. A tool directive is not a comment.
 * @param sources every source of the run
 * @returns the problems
 */
export function importComments(sources: SwiftSource[]): StructureProblem[] {
    return sources.flatMap((source) => {
        const nodes = source.tree.rootNode.namedChildren;
        const imports = nodes.filter((node) => node.type === 'import_declaration');
        const [first] = imports;
        const last = imports.at(-1);
        if (first === undefined || last === undefined) return [];
        return nodes
            .filter(
                (node) =>
                    COMMENTS.has(node.type) &&
                    node.startIndex > first.startIndex &&
                    node.startPosition.row <= last.endPosition.row &&
                    !DIRECTIVE.test(node.text),
            )
            .map((node) => ({
                file: source.path,
                line: node.startPosition.row + 1,
                rule: 'import-comment',
                text: 'No comments among imports. Say it where the import is used, or above the block.',
            }));
    });
}
