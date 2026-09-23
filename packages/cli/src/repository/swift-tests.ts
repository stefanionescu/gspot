import { parserFor } from '#cli/naming/parsers.ts';

/** Identify Swift test declarations and package targets without matching comment or string text. */
export async function swiftTestTags(text: string): Promise<string[]> {
    const parser = await parserFor('swift');
    const tree = parser.parse(text);
    if (tree === null) throw new Error('Swift test detection could not parse the source.');
    try {
        const imports = tree.rootNode.descendantsOfType('import_declaration');
        const attributes = tree.rootNode.descendantsOfType('attribute');
        const isTest =
            imports.some((node) => {
                const name = node.namedChildren.find((child) => child.type === 'identifier')?.text.split('.')[0];
                return name === 'XCTest' || name === 'Testing';
            }) ||
            attributes.some((node) => {
                const name = node.namedChildren.find((child) => child.type === 'user_type')?.text;
                return name !== undefined && ['Test', 'Suite', 'Testing.Test', 'Testing.Suite'].includes(name);
            });
        const hasTarget = tree.rootNode
            .descendantsOfType('call_expression')
            .some((node) => ['.testTarget', 'Target.testTarget'].includes(node.firstNamedChild?.text ?? ''));
        return [...(isTest ? ['swift-test'] : []), ...(hasTarget ? ['swift-test-target'] : [])];
    } finally {
        tree.delete();
    }
}
