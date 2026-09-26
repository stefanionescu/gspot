import type { Node } from 'web-tree-sitter';
import { pathMatcher } from '#cli/repository/paths.ts';
import { visibilityOf } from '#cli/checks/swift/sources.ts';
import type { SwiftSource } from '#cli/types/checks/swift.ts';
import type { StructureProblem } from '#cli/types/checks/structure.ts';
import { DECLARATIONS, ENVIRONMENT_READ, FILE_LOCAL } from '#cli/constants/checks/swift.ts';

function readLines(source: SwiftSource): number[] {
    return source.lines.flatMap((line, index) =>
        line.includes(ENVIRONMENT_READ) && !line.trimStart().startsWith('//') ? [index + 1] : [],
    );
}

// An extension carries the name of the type it extends, which is not the name of the thing to move.
function titleOf(node: Node): string {
    const name = node.childForFieldName('name')?.text ?? 'This declaration';
    return node.childForFieldName('declaration_kind')?.text === 'extension' ? `The extension of ${name}` : name;
}

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
            .map((node) => ({
                file: source.path,
                line: node.startPosition.row + 1,
                rule: 'private-below-shared',
                text: `${titleOf(node)} is ${visibilityOf(node)} and sits below a declaration other files see. File-local declarations come first.`,
            }));
    });
}

/**
 * Reads of the process environment outside its owner. With no owner named in the policy, one file that reads it is the owner,
 * and reads in more than one file are all findings, because nobody said which file owns them.
 * @param sources every source of the run
 * @param owners the paths architecture.roles.env names
 * @returns the problems
 */
export function environmentReads(sources: SwiftSource[], owners: string[]): StructureProblem[] {
    const isOwner = pathMatcher(owners);
    const readers = sources.filter((source) => !isOwner(source.path) && readLines(source).length > 0);
    if (owners.length === 0 && readers.length <= 1) return [];
    const text =
        owners.length === 0
            ? `${String(readers.length)} files read the process environment and the policy names no owner. Name one under architecture.roles.env and read it there.`
            : 'The process environment is read here, outside the environment owner. Read it there and pass the value in.';
    return readers.flatMap((source) =>
        readLines(source).map((line) => ({ file: source.path, line, rule: 'read-outside-owner', text })),
    );
}
