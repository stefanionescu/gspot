import { createRule } from '../../rule.ts';
import { LOOP_STATEMENTS } from '../../config/logic.ts';
import { getAssignedValue } from '../../language/modules.ts';
import { getRegex, buildRegexVisitors } from '../../language/regex.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { EXEC_METHOD, DISTINCT_SUBJECTS, EMPTY_STRING_TEXTS, STATEFUL_REGEX_METHODS } from '../../config/regex.ts';

function isLoopCondition(node: TSESTree.Node, ancestors: readonly TSESTree.Node[]): boolean {
    const chain = [...ancestors, node];
    const index = chain.findLastIndex(
        (ancestor) => LOOP_STATEMENTS.has(ancestor.type) || ASTUtils.isFunction(ancestor),
    );
    const loop = chain[index];
    return loop !== undefined && !ASTUtils.isFunction(loop) && 'test' in loop && Object.is(loop.test, chain[index + 1]);
}

function isLoopExec(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.MemberExpression || parent.object !== node) return false;
    const isExec =
        ASTUtils.getPropertyName(parent) === EXEC_METHOD && parent.parent.type === AST_NODE_TYPES.CallExpression;
    return isExec && isLoopCondition(node, source.getAncestors(node));
}

function getCalledRegex(node: TSESTree.CallExpression): TSESTree.Identifier | undefined {
    const { callee } = node;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || node.arguments.length !== 1) return undefined;
    const isStateful = STATEFUL_REGEX_METHODS.has(ASTUtils.getPropertyName(callee));
    return isStateful && ASTUtils.isIdentifier(callee.object) ? callee.object : undefined;
}

function getGlobalVariable(node: TSESTree.CallExpression, source: TSESLint.SourceCode) {
    const name = getCalledRegex(node);
    const variable = name === undefined ? null : ASTUtils.findVariable(source.getScope(node), name);
    const value = variable === null ? undefined : getAssignedValue(variable);
    const regex = value === undefined ? undefined : getRegex(value, source);
    return regex?.flags.global === true && variable !== null ? variable : undefined;
}

function isReusedOnSubjects(uses: readonly TSESTree.CallExpression[], source: TSESLint.SourceCode): boolean {
    const subjects = new Set(uses.map(({ arguments: [input] }) => source.getText(input)));
    return subjects.size >= DISTINCT_SUBJECTS && subjects.isDisjointFrom(EMPTY_STRING_TEXTS);
}

export const noStatefulRegex = createRule<[], 'loop' | 'subjects'>({
    name: 'no-stateful-regex',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports `exec` on a new global regular expression in the condition of a loop, and a global regular expression variable whose `test` or `exec` runs on different subjects without a reset of `lastIndex`.',
            why: 'A global regular expression remembers where its last match ended, so the next call on another input starts in the middle and can miss the match.',
            fix: 'Remove the `g` flag when the expression only tests, reset `lastIndex` before each new input, or create the expression once outside the loop.',
            example: '`const word = /a/g; word.test(first); word.test(second);` reports `subjects`.',
        },
        schema: [],
        messages: {
            loop: 'This creates a new regular expression on each check, so the loop never ends. Create it once outside the loop.',
            subjects:
                'This global regular expression runs on different subjects and keeps its lastIndex. Remove the g flag.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const calls = new Map<TSESLint.Scope.Variable, TSESTree.CallExpression[]>();
        const resets = new Set<TSESLint.Scope.Variable>();
        return {
            ...buildRegexVisitors((node, { flags }) => {
                if (flags.global && isLoopExec(node, source)) context.report({ node, messageId: 'loop' });
            }, source),
            'CallExpression:exit'(node: TSESTree.CallExpression) {
                const variable = getGlobalVariable(node, source);
                if (variable === undefined) return;
                calls.set(variable, [...(calls.get(variable) ?? []), node]);
            },
            'AssignmentExpression > MemberExpression.left'(node: TSESTree.MemberExpression) {
                if (!ASTUtils.isIdentifier(node.object) || ASTUtils.getPropertyName(node) !== 'lastIndex') return;
                const variable = ASTUtils.findVariable(source.getScope(node), node.object);
                if (variable !== null) resets.add(variable);
            },
            'Program:exit'() {
                for (const [variable, uses] of calls) {
                    const declarator = variable.defs[0]?.node;
                    if (resets.has(variable) || !isReusedOnSubjects(uses, source)) continue;
                    if (declarator?.type === AST_NODE_TYPES.VariableDeclarator && declarator.init !== null)
                        context.report({ node: declarator.init, messageId: 'subjects' });
                }
            },
        };
    },
});
