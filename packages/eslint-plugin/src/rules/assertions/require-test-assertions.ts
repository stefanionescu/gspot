import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { usesModule } from '../../libraries/packages.ts';
import { listChildNodes } from '../../libraries/testing.ts';
import type { AssertionSearch } from '../../types/assertions.ts';
import { readAssertionKind, isChaiPropertyAssertion } from '../../libraries/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    ASSERTION_TEXT,
    DONE_CALLBACKS,
    EVIDENCE_IMPORTS,
    HTTP_EXPECTATIONS,
    CHECKED_TEST_CALLEE,
    HTTP_TESTING_MODULE,
    EVIDENCE_DEPENDENCIES,
    TEST_FRAMEWORK_IMPORTS,
    TEST_FRAMEWORK_DEPENDENCIES,
} from '../../config/assertions/evidence.ts';

function getTestCallback(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const callback = node.arguments.at(1);
    const isTest = CHECKED_TEST_CALLEE.test(source.getText(node.callee));
    return isTest && callback !== undefined && ASTUtils.isFunction(callback) ? callback : undefined;
}

function usesDone(callback: TSESTree.Node, source: TSESLint.SourceCode, doneUses: ReadonlySet<TSESTree.Node>): boolean {
    const [done] = source.getDeclaredVariables(callback);
    const isFirst = ASTUtils.isFunction(callback) && callback.params[0]?.type === AST_NODE_TYPES.Identifier;
    return isFirst && done?.references.some((reference) => doneUses.has(reference.identifier)) === true;
}

function getLocalBody(node: TSESTree.Node | undefined): TSESTree.Node | undefined {
    const value = node?.type === AST_NODE_TYPES.VariableDeclarator ? node.init : node;
    const isFunction = value !== null && value !== undefined && ASTUtils.isFunction(value);
    return isFunction ? value.body : undefined;
}

function isHttpExpectation(node: TSESTree.CallExpression, types: TypeReader | undefined): boolean {
    const { callee } = node;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    const declaration = types?.get(callee).getCallSignatures().at(0)?.getDeclaration();
    const file = declaration?.getSourceFile().fileName ?? '';
    return HTTP_EXPECTATIONS.has(method) && file.includes(HTTP_TESTING_MODULE);
}

function getImportedText(callee: TSESTree.Node, types: TypeReader): string {
    const declaration = types.get(callee).getCallSignatures().at(0)?.getDeclaration();
    const isOwn = declaration !== undefined && !types.program.isSourceFileDefaultLibrary(declaration.getSourceFile());
    return isOwn ? declaration.getText() : '';
}

function hasCalleeAssertion(node: TSESTree.CallExpression, search: AssertionSearch): boolean {
    const { callee } = node;
    const variable =
        callee.type === AST_NODE_TYPES.Identifier
            ? ASTUtils.findVariable(search.source.getScope(callee), callee)
            : null;
    const body = getLocalBody(variable?.defs.at(0)?.node);
    const text = search.types === undefined || body !== undefined ? '' : getImportedText(callee, search.types);
    return body === undefined ? ASSERTION_TEXT.test(text) : hasAssertion(body, search);
}

function isEvidence(node: TSESTree.Node, search: AssertionSearch): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression) return isChaiPropertyAssertion(node);
    const isAssertion = readAssertionKind(node, search.context) !== undefined;
    return isAssertion || isHttpExpectation(node, search.types) || hasCalleeAssertion(node, search);
}

function hasAssertion(node: TSESTree.Node, search: AssertionSearch): boolean {
    const cached = search.visited.get(node);
    if (cached !== undefined) return cached;
    search.visited.set(node, false);
    const found =
        isEvidence(node, search) || listChildNodes(node, search.source).some((child) => hasAssertion(child, search));
    search.visited.set(node, found);
    return found;
}

export const requireTestAssertions = createRule<[], 'missing'>({
    name: 'require-test-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a test of Mocha, Jasmine, Jest, Vitest, Bun, Playwright, Cypress, or node:test, an `it`, `specify`, or `test` call with a callback, that runs no assertion of chai, sinon, supertest, node:assert, node:test, uvu, aws-cdk, Vitest, Bun, Cypress, or a global `expect`. It reads the functions of the file that the test calls, and, with the type information of a TypeScript project, the text of the functions it imports. A test that passes an error to its `done` callback counts as one that asserts.',
            why: 'A test without an assertion passes whatever the code does, so it checks only that the code does not throw.',
            fix: 'Assert the result of the code under test.',
            example:
                '`it("saves", () => { save(item); })` reports `missing`. Add `expect(load(item.id)).to.deep.equal(item)`.',
        },
        schema: [],
        messages: { missing: 'Add at least one assertion to this test.' },
    },
    create(context) {
        const source = context.sourceCode;
        const doneUses = new Set<TSESTree.Node>();
        const hasTests = usesModule(context, TEST_FRAMEWORK_IMPORTS, TEST_FRAMEWORK_DEPENDENCIES);
        const search = { context, source, types: getTypes(context), visited: new Map<TSESTree.Node, boolean>() };
        if (!hasTests || !usesModule(context, EVIDENCE_IMPORTS, EVIDENCE_DEPENDENCIES)) return {};
        return {
            [DONE_CALLBACKS]: (node: TSESTree.Identifier) => doneUses.add(node),
            'CallExpression:exit'(node: TSESTree.CallExpression) {
                const callback = getTestCallback(node, source);
                const isChecked =
                    callback === undefined || usesDone(callback, source, doneUses) || hasAssertion(callback, search);
                if (!isChecked) context.report({ node: node.callee, messageId: 'missing' });
            },
        };
    },
});
