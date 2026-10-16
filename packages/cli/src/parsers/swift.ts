// Identifies Swift imports, tests, and package targets.
import { posix } from 'node:path';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { SWIFT_TEST_TAG } from '#cli/config/repository/inventory.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/dependency-files.ts';

import {
    SWIFT_TYPE_NODE,
    SWIFT_CALL_NODE,
    SWIFT_IMPORT_TAG,
    SWIFT_IMPORT_NODE,
    SWIFT_TEST_MODULES,
    SWIFT_ATTRIBUTE_NODE,
    SWIFT_IDENTIFIER_NODE,
    SWIFT_TEST_ATTRIBUTES,
    SWIFT_TEST_TARGET_TAG,
    SWIFT_TEST_TARGET_CALLS,
} from '#cli/config/parsers/swift.ts';

/**
 * Identify Swift imports, test declarations, and package targets without matching comment or string text.
 * @param path the repository-relative source file.
 * @param text the Swift source.
 * @returns the imported modules, test frameworks, and target kinds the source declares.
 */
export async function detectSwiftTags(path: string, text: string): Promise<string[]> {
    const tree = await parseSource('swift', text);
    try {
        const imports = tree.rootNode
            .descendantsOfType(SWIFT_IMPORT_NODE)
            .map(
                (node) =>
                    node.namedChildren.find((child) => child.type === SWIFT_IDENTIFIER_NODE)?.text.split('.', 1)[0],
            )
            .filter((name) => name !== undefined);
        const attributes = tree.rootNode.descendantsOfType(SWIFT_ATTRIBUTE_NODE);
        const isTest =
            imports.some((name) => new Set<string | undefined>(SWIFT_TEST_MODULES).has(name)) ||
            attributes.some((node) => {
                const name = node.namedChildren.find((child) => child.type === SWIFT_TYPE_NODE)?.text;
                return name !== undefined && new Set<string | undefined>(SWIFT_TEST_ATTRIBUTES).has(name);
            });
        const hasTarget = tree.rootNode
            .descendantsOfType(SWIFT_CALL_NODE)
            .some((node) => new Set<string | undefined>(SWIFT_TEST_TARGET_CALLS).has(node.firstNamedChild?.text));
        return [
            ...new Set(imports.map((name) => `${SWIFT_IMPORT_TAG}${name}`)),
            ...(isTest ? [SWIFT_TEST_TAG] : []),
            ...(hasTarget && posix.basename(path) === PACKAGE_SWIFT ? [SWIFT_TEST_TARGET_TAG] : []),
        ];
    } finally {
        tree.delete();
    }
}
