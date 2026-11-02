import { createRule } from '../../rule.ts';
import { FUNCTION_NODES } from '../../config/plugin.ts';
import { usesModule } from '../../libraries/packages.ts';
import { getLocalFunction } from '../../language/functions.ts';
import { getTestCall, listChildNodes } from '../../libraries/testing.ts';
import type { TestCall, TitleScan, FunctionNode } from '../../types/rules.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RUNNING_TEST_MODIFIERS, TEST_FRAMEWORK_MODULES } from '../../config/testing.ts';

function getRunningCall(call: TestCall | undefined, kind: TestCall['kind']): TestCall | undefined {
    if (call?.kind !== kind) return undefined;
    const isRunning = call.modifiers.every((modifier) => RUNNING_TEST_MODIFIERS.has(modifier));
    return isRunning && (kind === 'suite' || call.callback !== undefined) ? call : undefined;
}

function checkTitle(node: TSESTree.CallExpression, titles: Map<string, TSESTree.Node>, scan: TitleScan): void {
    const [title] = node.arguments;
    const text = title === undefined ? null : ASTUtils.getStringIfConstant(title);
    if (title === undefined || text === null) return;
    if (titles.has(text)) scan.report(title);
    else titles.set(text, title);
}

function scanFunctionBody(node: TSESTree.Node, titles: Map<string, TSESTree.Node>, scan: TitleScan): void {
    if (node.type === AST_NODE_TYPES.CallExpression) {
        scanCall(node, titles, scan);
        return;
    }
    const children = listChildNodes(node, scan.source).filter((child) => !FUNCTION_NODES.has(child.type));
    for (const child of children) scanFunctionBody(child, titles, scan);
}

function scanCall(node: TSESTree.CallExpression, titles: Map<string, TSESTree.Node>, scan: TitleScan): void {
    const call = getTestCall(node, scan.source);
    const body = getRunningCall(call, 'suite')?.callback?.body;
    if (body !== undefined) scanFunctionBody(body, new Map(), scan);
    if (call?.kind === 'suite') return;
    checkCall(node, titles, scan);
    if (getRunningCall(call, 'test') !== undefined) return;
    const children = listChildNodes(node, scan.source).filter((child) => !FUNCTION_NODES.has(child.type));
    for (const child of children) scanFunctionBody(child, titles, scan);
}

function checkCall(node: TSESTree.CallExpression, titles: Map<string, TSESTree.Node>, scan: TitleScan): void {
    if (getRunningCall(getTestCall(node, scan.source), 'test') !== undefined) {
        checkTitle(node, titles, scan);
        return;
    }
    const body = getLocalFunction(node.callee, scan.source)?.body;
    if (body === undefined || scan.path.has(body)) return;
    scan.path.add(body);
    scanFunctionBody(body, titles, scan);
    scan.path.delete(body);
}

export const noDuplicateTestTitles = createRule<[], 'duplicate'>({
    name: 'no-duplicate-test-titles',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a test whose static title repeats the title of an earlier test of the same suite, in files that import a test framework or whose package.json depends on one. It also reads the tests that a local function declares when the suite calls it. Skipped and parameterized suites are not checked.',
            why: 'Two tests with one title look like one test in a report, so a failure points to the wrong test.',
            fix: 'Give each test of a suite its own title, or delete the copy.',
            example: '`it("adds", a); it("adds", b);` reports `duplicate` on the second title.',
        },
        schema: [],
        messages: { duplicate: 'Rename this test title to make it unique within the suite.' },
    },
    create(context) {
        if (!usesModule(context, [...TEST_FRAMEWORK_MODULES])) return {};
        const scan: TitleScan = {
            source: context.sourceCode,
            path: new Set(),
            report: (node) => {
                context.report({ node, messageId: 'duplicate' });
            },
        };
        const frames = new Map<TSESTree.Node, Map<string, TSESTree.Node>>();
        return {
            CallExpression(node) {
                const functions = context.sourceCode
                    .getAncestors(node)
                    .filter((ancestor): ancestor is FunctionNode => FUNCTION_NODES.has(ancestor.type));
                const isSuiteLevel = functions.every(
                    (callback) =>
                        callback.parent.type === AST_NODE_TYPES.CallExpression &&
                        getRunningCall(getTestCall(callback.parent, context.sourceCode), 'suite')?.callback
                            ?.range[0] === callback.range[0],
                );
                if (!isSuiteLevel) return;
                const suite = functions.at(-1) ?? context.sourceCode.ast;
                const titles = frames.get(suite) ?? new Map<string, TSESTree.Node>();
                frames.set(suite, titles);
                checkCall(node, titles, scan);
            },
        };
    },
});
