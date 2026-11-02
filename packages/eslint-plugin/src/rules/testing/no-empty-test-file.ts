import { createRule } from '../../rule.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { TEST_FILE_PATTERN, TEST_DECLARATIONS, TITLED_TEST_DECLARATIONS } from '../../config/testing.ts';

function getChainName(node: TSESTree.Node): string {
    if (node.type === AST_NODE_TYPES.Identifier) return node.name;
    return node.type === AST_NODE_TYPES.MemberExpression && node.property.type === AST_NODE_TYPES.Identifier
        ? `${getChainName(node.object)}.${node.property.name}`
        : '';
}

function isTitledDeclaration(name: string, call: TSESTree.CallExpression): boolean {
    const [title, , cases] = call.arguments;
    if (title?.type !== AST_NODE_TYPES.Literal || typeof title.value !== 'string') return false;
    return (
        TITLED_TEST_DECLARATIONS.has(name) || (name.endsWith('.run') && cases?.type === AST_NODE_TYPES.ObjectExpression)
    );
}

export const noEmptyTestFile = createRule<[], 'empty'>({
    name: 'no-empty-test-file',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a file named `*.test.*`, `*.spec.*`, or `*.cy.*` that declares no test: no `it`, `test`, `specify`, or `Deno.test` call in any of their forms, no titled Playwright `test.skip`, `test.fail`, or `test.fixme`, no `ruleTester.run`, and no other `.run` call with a title and an object of cases.',
            why: 'A test file without tests passes and checks nothing, so it hides that the tests it should hold are gone.',
            fix: 'Add the tests that the file is named for, or delete the file.',
            example:
                'A `cart.test.ts` that only exports helpers reports `empty`. Move the helpers to a file without the test suffix.',
        },
        schema: [],
        messages: { empty: 'Add some tests to this file or delete it.' },
    },
    create(context) {
        if (!TEST_FILE_PATTERN.test(context.filename)) return {};
        let hasTest = false;
        return {
            'CallExpression, TaggedTemplateExpression'(
                node: TSESTree.CallExpression | TSESTree.TaggedTemplateExpression,
            ) {
                const isCall = node.type === AST_NODE_TYPES.CallExpression;
                const name = getChainName(isCall ? node.callee : node.tag);
                hasTest ||= TEST_DECLARATIONS.has(name) || (isCall && isTitledDeclaration(name, node));
            },
            'Program:exit'() {
                const isEmpty = !hasTest;
                hasTest = false;
                if (isEmpty) context.report({ loc: { line: 1, column: 0 }, messageId: 'empty' });
            },
        };
    },
});
