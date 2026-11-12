import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    ASSERTION_TEXT,
    CHECKED_TEST_CALLEE,
    DONE_CALLBACKS,
    EVIDENCE_DEPENDENCIES,
    EVIDENCE_IMPORTS,
    HTTP_EXPECTATIONS,
    HTTP_TESTING_MODULE,
    TEST_FRAMEWORK_DEPENDENCIES,
    TEST_FRAMEWORK_IMPORTS,
} from '../../config/assertions/evidence.ts';
import { getTypes } from '../../language/checker.ts';
import { listChildren } from '../../language/syntax.ts';
import { readAssertionKind } from '../../libraries/assertions.ts';
import { isModuleUsed } from '../../libraries/packages.ts';
import { createRule } from '../../rule.ts';
import type { AssertionSearch } from '../../types/assertions.ts';
import type { TypeReader } from '../../types/plugin.ts';

const CHAI_TERMINALS: ReadonlySet<string | null> = new Set([
    'Arguments',
    'NaN',
    'arguments',
    'empty',
    'exist',
    'extensible',
    'false',
    'finite',
    'frozen',
    'null',
    'ok',
    'sealed',
    'true',
    'undefined',
]);

function getTestCallback(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const callback = node.arguments.at(1);
    const isTest = CHECKED_TEST_CALLEE.test(source.getText(node.callee));
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
            'CallExpression:exit'(node: TSESTree.CallExpression) {
                const callback = getTestCallback(node, source);
                const isChecked =
                    callback === undefined || isDoneUsed(callback, source, doneUses) || hasAssertion(callback, search);
                if (!isChecked) context.report({ node: node.callee, messageId: 'missing' });
            },
        };
    },
});
