import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { EXPLANATION_LETTER, NODE_TEST_MODULES, SKIP_FRAMEWORKS, SKIPPED_TEST_CALLS } from '../../config/testing.ts';
import { getLiteralValue, getOptionProperties } from '../../language/expressions.ts';
import { readPackageFacts } from '../../language/packages.ts';
import { getTestCall, isPlaywrightSuite } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { FileContext, FunctionNode } from '../../types/plugin.ts';
import type { SkipFramework, TestCall } from '../../types/testing.ts';

function selectFramework(context: FileContext): SkipFramework | 'node' | undefined {
    const facts = readPackageFacts(context);
    const match = SKIP_FRAMEWORKS.find(({ dependencies }) =>
        dependencies.some((dependency) => facts.dependencies.has(dependency)),
    );
    if (match !== undefined) return match.framework;
    return facts.manifests > 0 ? 'node' : undefined;
}

function isSkippedCall(call: TSESTree.CallExpression, framework: SkipFramework): boolean {
    const { callee } = call;
    const names: { skipped: readonly string[]; disabled: readonly string[] } = SKIPPED_TEST_CALLS[framework];
    if (callee.type === AST_NODE_TYPES.Identifier) return names.disabled.includes(callee.name);
    if (callee.type !== AST_NODE_TYPES.MemberExpression || ASTUtils.getPropertyName(callee) !== 'skip') return false;
    const name = callee.object.type === AST_NODE_TYPES.Identifier ? callee.object.name : '';
    if (framework !== 'playwright') return names.skipped.includes(name);
    const title = call.arguments.map((argument) => (argument.type === AST_NODE_TYPES.Literal ? argument.value : null));
    return typeof title[0] === 'string' && (name === 'test' || isPlaywrightSuite(callee.object));
}

function getNodeTest(node: TSESTree.CallExpression, source: TSESLint.SourceCode): TestCall | undefined {
    const call = getTestCall(node, source);
    const isCalledByName =
        node.callee.type === AST_NODE_TYPES.Identifier && call?.name === 'test' && NODE_TEST_MODULES.has(call.module);
    return isCalledByName ? call : undefined;
}

function isSilentSkip(member: TSESTree.Node): boolean {
    if (member.type !== AST_NODE_TYPES.MemberExpression || member.parent.type !== AST_NODE_TYPES.CallExpression)
        return false;
    const call = member.parent;
    const [reason] = call.arguments;
    const isSilent = reason === undefined || ASTUtils.getStringIfConstant(reason) === '';
    return isSilent && call.callee === member && ASTUtils.getPropertyName(member) === 'skip';
}

function findSilentSkip(callback: FunctionNode, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const [parameter] = callback.params;
    const variable =
        parameter?.type === AST_NODE_TYPES.Identifier
            ? ASTUtils.findVariable(source.getScope(callback), parameter)
            : null;
    const members = (variable?.references ?? []).map(({ identifier }) => identifier.parent);
    return members.find((member) => isSilentSkip(member));
}

export const noUnexplainedTestSkips = createRule<[], 'skipped'>({
    name: 'no-unexplained-test-skips',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a skipped test or suite, such as `it.skip` or `xdescribe`, with no comment that gives a reason on the line above, on its line, or on the line below.',
            why: 'A skipped test stops checking its code. Without a reason, nobody knows when to turn it back on or whether to delete it.',
            fix: 'Delete the test, fix it so it runs, or write the reason in a comment next to it.',
            example:
                '`it.skip("adds", run)` reports `skipped`. Add `// Waits for the new tax table.` on the line above, or delete the test.',
        },
        schema: [],
        messages: { skipped: 'Remove this skipped test, or explain in a comment why it is skipped.' },
    },
    create(context) {
        const framework = selectFramework(context);
        const source = context.sourceCode;
        if (framework === 'node')
            return {
                'CallExpression[arguments.length=2]'(node: TSESTree.CallExpression) {
                    const callback = getNodeTest(node, source)?.callback;
                    const isLast = callback !== undefined && callback === node.arguments[1];
                    const skip = isLast ? findSilentSkip(callback, source) : undefined;
                    if (skip !== undefined) context.report({ node: skip, messageId: 'skipped' });
                },
                'CallExpression[arguments.length=3]'(node: TSESTree.CallExpression) {
                    const options = getNodeTest(node, source) && node.arguments[1];
                    const skip = getOptionProperties(options, source).get('skip');
                    const value = getLiteralValue(skip?.value, source);
                    if (skip !== undefined && (value === true || value === ''))
                        context.report({ node: skip, messageId: 'skipped' });
                },
            };
        if (framework === undefined) return {};
        return {
            CallExpression(node) {
                if (!isSkippedCall(node, framework)) return;
                const isExplained = source
                    .getAllComments()
                    .some(
                        ({ loc, value }) =>
                            Math.abs(loc.end.line - node.loc.start.line) <= 1 && EXPLANATION_LETTER.test(value.trim()),
                    );
                if (!isExplained) context.report({ node: node.callee, messageId: 'skipped' });
            },
        };
    },
});
