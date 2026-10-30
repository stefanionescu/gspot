import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects/dependencies.ts';

import {
    SWIFT_TEST_TAG,
    SWIFT_CALL_NODE,
    SWIFT_TYPE_NODE,
    SWIFT_IMPORT_TAG,
    SWIFT_IMPORT_NODE,
    SWIFT_TEST_MODULES,
    SWIFT_ATTRIBUTE_NODE,
    SWIFT_IDENTIFIER_NODE,
    SWIFT_TEST_TARGET_TAG,
    SWIFT_TEST_ATTRIBUTES,
    SWIFT_TEST_TARGET_CALLS,
} from '#cli/config/parsers/code/swift.ts';

/**
Identify Swift imports, test declarations, and package targets without matching comment or string text.

@param path the repository-relative source file.
@param text the Swift source.
*/
export async function detectSwiftTags(path: string, text: string): Promise<string[]> {
    using tree = await parseSource('swift', text);
    const imports = tree.rootNode
        .descendantsOfType(SWIFT_IMPORT_NODE)
        .map((node) => findImportedModule(node))
        .filter((name) => name !== undefined);
    const attributes = tree.rootNode.descendantsOfType(SWIFT_ATTRIBUTE_NODE);
    const isTest =
        imports.some((name) => SWIFT_TEST_MODULES.has(name)) ||
        attributes.some((node) => {
            const name = node.namedChildren.find((child) => child.type === SWIFT_TYPE_NODE)?.text;
            return name !== undefined && SWIFT_TEST_ATTRIBUTES.has(name);
        });
    const hasTarget = tree.rootNode
        .descendantsOfType(SWIFT_CALL_NODE)
        .some((node) => SWIFT_TEST_TARGET_CALLS.has(node.firstNamedChild?.text ?? ''));
    return [
        ...new Set(imports.map((name) => `${SWIFT_IMPORT_TAG}${name}`)),
        ...(isTest ? [SWIFT_TEST_TAG] : []),
        ...(hasTarget && posix.basename(path) === PACKAGE_SWIFT ? [SWIFT_TEST_TARGET_TAG] : []),
    ];
}

/**
Get the top-level module named by a Swift import declaration.

@param node the import declaration.
@returns the imported module, when the declaration names one.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Swift tags and the Swift import rules read the imported module by the same rule.
export function findImportedModule(node: Node): string | undefined {
    return node.namedChildren.find((child) => child.type === SWIFT_IDENTIFIER_NODE)?.text.split('.', 1)[0];
}
