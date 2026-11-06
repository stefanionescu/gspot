import { posix } from 'node:path';

import type { Node } from 'web-tree-sitter';

import {
    PACKAGE_SWIFT,
    SWIFT_ATTRIBUTE_NODE,
    SWIFT_CALL_NODE,
    SWIFT_IDENTIFIER_NODE,
    SWIFT_IMPORT_NODE,
    SWIFT_IMPORT_TAG,
    SWIFT_TAG_WORDS,
    SWIFT_TEST_ATTRIBUTES,
    SWIFT_TEST_MODULES,
    SWIFT_TEST_TAG,
    SWIFT_TEST_TARGET_CALLS,
    SWIFT_TEST_TARGET_TAG,
    SWIFT_TYPE_NODE,
} from '#cli/config/parsers.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';

/**
Identify Swift imports, test declarations, and package targets without matching comment or string text.
*/
export async function detectSwiftTags(path: string, text: string): Promise<string[]> {
    if (!SWIFT_TAG_WORDS.test(text)) return [];
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

export function findImportedModule(node: Node): string | undefined {
    return node.namedChildren.find((child) => child.type === SWIFT_IDENTIFIER_NODE)?.text.split('.', 1)[0];
}
