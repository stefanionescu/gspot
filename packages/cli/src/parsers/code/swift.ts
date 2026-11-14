import { posix } from 'node:path';
import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { PACKAGE_SWIFT } from '#cli/config/parsers/projects.ts';

import {
    SWIFT_TEST_TAG,
    SWIFT_CALL_NODE,
    SWIFT_TAG_WORDS,
    SWIFT_TYPE_NODE,
    SWIFT_IMPORT_TAG,
    SWIFT_IMPORT_NODE,
    SWIFT_TEST_MODULES,
    SWIFT_ATTRIBUTE_NODE,
    SWIFT_IDENTIFIER_NODE,
    SWIFT_TEST_ATTRIBUTES,
    SWIFT_TEST_TARGET_TAG,
    SWIFT_TEST_TARGET_CALLS,
    PRIVATE_SWIFT_VISIBILITIES,
} from '#cli/config/parsers/code.ts';

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

export function isPrivateSwiftDeclaration(declaration: Node): boolean {
    const modifiers = declaration.namedChildren.find((child) => child.type === 'modifiers')?.namedChildren ?? [];
    return modifiers.some(
        (modifier) => modifier.type === 'visibility_modifier' && PRIVATE_SWIFT_VISIBILITIES.has(modifier.text),
    );
}

export function listSwiftCallArguments(call: Node): Node[] {
    const argumentsNode = call.namedChildren
        .find((node) => node.type === 'call_suffix')
        ?.namedChildren.find((node) => node.type === 'value_arguments');
    return argumentsNode?.namedChildren ?? [];
}
