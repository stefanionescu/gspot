import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { listChildren } from '../../language/syntax.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { isModuleUsed } from '../../language/packages.ts';
import { getCalleeChain } from '../../libraries/testing.ts';
import type { AssertionSearch } from '../../types/assertions.ts';
import { readAssertionKind } from '../../libraries/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    ASSERTION_TEXT,
    CHAI_TERMINALS,
    DONE_CALLBACKS,
    EVIDENCE_IMPORTS,
    HTTP_EXPECTATIONS,
    CHECKED_TEST_NAMES,
    HTTP_TESTING_MODULE,
    EVIDENCE_DEPENDENCIES,
    CHECKED_TEST_MODIFIERS,
    TEST_FRAMEWORK_IMPORTS,
    TEST_FRAMEWORK_DEPENDENCIES,
} from '../../config/assertions/evidence.ts';

/**
Get the callback of a test that the rule checks. The callee name decides, so a test fixture that `test.extend` builds
and the `test` of uvu count too. A member such as `step` or `describe` makes the call something other than a test.
*/
function getCheckedTestCallback(node: TSESTree.CallExpression): TSESTree.Node | undefined {
    const chain = getCalleeChain(node.callee);
    const callback = node.arguments.at(1);
    const isTest =
        chain !== undefined &&
        CHECKED_TEST_NAMES.has(chain.base.name) &&
        chain.modifiers.every((modifier) => CHECKED_TEST_MODIFIERS.has(modifier));
    return isTest && callback !== undefined && ASTUtils.isFunction(callback) ? callback : undefined;
}

function isDoneUsed(
    callback: TSESTree.Node,
    source: TSESLint.SourceCode,
    doneUses: ReadonlySet<TSESTree.Node>,
): boolean {
    const [done] = source.getDeclaredVariables(callback);
    const isFirst = ASTUtils.isFunction(callback) && callback.params[0]?.type === AST_NODE_TYPES.Identifier;
    return isFirst && done?.references.some((reference) => doneUses.has(reference.identifier)) === true;
}

function getLocalBody(node: TSESTree.Node | undefined): TSESTree.Node | undefined {
    const value = node?.type === AST_NODE_TYPES.VariableDeclarator ? node.init : node;
    const isFunction = value !== null && value !== undefined && ASTUtils.isFunction(value);
    return isFunction ? value.body : undefined;
}

function getCallDeclaration(callee: TSESTree.Node, types: TypeReader) {
    return types.get(callee).getCallSignatures().at(0)?.getDeclaration();
}

function isHttpExpectation(node: TSESTree.CallExpression, types: TypeReader | undefined): boolean {
    const { callee } = node;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    const declaration = types && getCallDeclaration(callee, types);
    const file = declaration?.getSourceFile().fileName ?? '';
    return HTTP_EXPECTATIONS.has(method) && file.includes(HTTP_TESTING_MODULE);
}

function getImportedText(callee: TSESTree.Node, types: TypeReader): string {
    const declaration = getCallDeclaration(callee, types);
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
    const text = body !== undefined || search.types === undefined ? '' : getImportedText(callee, search.types);
    return body === undefined ? ASSERTION_TEXT.test(text) : hasAssertion(body, search);
}

function getChainEnd(node: TSESTree.MemberExpression): TSESTree.MemberExpression | undefined {
    let top = node;
    while (top.parent.type === AST_NODE_TYPES.MemberExpression && top.parent.object === top && !top.parent.computed)
        top = top.parent;
    return top === node ? undefined : top;
}

function isChaiPropertyAssertion(node: TSESTree.Node): boolean {
    const top =
        node.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(node) === 'should'
            ? getChainEnd(node)
            : undefined;
    const isCall = top?.parent.type === AST_NODE_TYPES.CallExpression && top.parent.callee === top;
    return top !== undefined && (isCall || CHAI_TERMINALS.has(ASTUtils.getPropertyName(top)));
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
    const isFound =
        isEvidence(node, search) ||
        listChildren(node, search.source.visitorKeys).some((child) => hasAssertion(child, search));
    search.visited.set(node, isFound);
    return isFound;
}

export const requireTestAssertions = createRule<[], 'missing'>({
    name: 'require-test-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a test, an `it`, `specify`, or `test` call with a callback, that runs no assertion, through the functions of the file that it calls and, with type information, the functions that it imports.',
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
        const hasTests = isModuleUsed(context, TEST_FRAMEWORK_IMPORTS, TEST_FRAMEWORK_DEPENDENCIES);
        const search = { context, source, types: getTypes(context), visited: new Map<TSESTree.Node, boolean>() };
        if (!hasTests || !isModuleUsed(context, EVIDENCE_IMPORTS, EVIDENCE_DEPENDENCIES)) return {};
        return {
            [DONE_CALLBACKS]: (node: TSESTree.Identifier) => doneUses.add(node),
            'CallExpression:exit': function (node: TSESTree.CallExpression) {
                const callback = getCheckedTestCallback(node);
                const isChecked =
                    callback === undefined || isDoneUsed(callback, source, doneUses) || hasAssertion(callback, search);
                if (!isChecked) context.report({ node: node.callee, messageId: 'missing' });
            },
        };
    },
});
