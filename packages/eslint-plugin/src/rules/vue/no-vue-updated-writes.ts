import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { TERMINATING_STATEMENTS } from '../../config/control-flow.ts';
import {
    GUARD_TESTS,
    VOLATILE_CALLS,
    VUE_DEFINE_COMPONENT,
    VUE_ON_UPDATED,
    VUE_OPTION_PROPERTIES,
    VUE_REACTIVE,
    VUE_REF,
} from '../../config/vue.ts';
import { getExpressionValue } from '../../language/expressions.ts';
import { listFunctionAncestors } from '../../language/functions.ts';
import { getModuleName } from '../../language/modules.ts';
import { listBodyNodes } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';

function getHookBody(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const variable =
        node?.type === AST_NODE_TYPES.Identifier ? ASTUtils.findVariable(source.getScope(node), node) : null;
    const owner = [getExpressionValue(node, source), variable?.defs.at(0)?.node].find(
        (value) => value !== undefined && ASTUtils.isFunction(value),
    );
    return owner !== undefined && ASTUtils.isFunction(owner) ? owner.body : undefined;
}

function isUpdatedOption(node: TSESTree.Property, source: TSESLint.SourceCode): boolean {
    const owner = node.parent.parent;
    const isComponent =
        owner.type === AST_NODE_TYPES.ExportDefaultDeclaration ||
        (owner.type === AST_NODE_TYPES.CallExpression && getModuleName(owner.callee, source) === VUE_DEFINE_COMPONENT);
    return isComponent && ASTUtils.getPropertyName(node) === 'updated';
}

function getTarget(node: TSESTree.Node, source: TSESLint.SourceCode): string | undefined {
    const isMember = node.type === AST_NODE_TYPES.MemberExpression && !node.computed;
    const state = isMember ? getExpressionValue(node.object, source) : undefined;
    const kind = state?.type === AST_NODE_TYPES.CallExpression ? getModuleName(state.callee, source) : undefined;
    const text = source.getText(node);
    return kind === VUE_REACTIVE || (kind === VUE_REF && text.endsWith('.value')) ? text : undefined;
}

function isTerminating(statement: TSESTree.Statement | undefined): boolean {
    const type = statement?.type;
    const last = statement?.type === AST_NODE_TYPES.BlockStatement ? statement.body.at(-1) : undefined;
    return TERMINATING_STATEMENTS.has(type) || (last !== undefined && isTerminating(last));
}

function isGuardStep(ancestor: TSESTree.Node, child: TSESTree.Node): boolean {
    const field = GUARD_TESTS.get(ancestor.type);
    if (field !== undefined) return ancestor[field as keyof TSESTree.Node] !== child;
    const earlier = ancestor.type === AST_NODE_TYPES.BlockStatement ? ancestor.body : [];
    return earlier.some(
        (statement) =>
            statement.range[1] <= child.range[0] &&
            statement.type === AST_NODE_TYPES.IfStatement &&
            statement.alternate === null &&
            isTerminating(statement.consequent),
    );
}

function isVolatile(node: TSESTree.Node, target: string, source: TSESLint.SourceCode): boolean {
    const isCounter = node.type === AST_NODE_TYPES.UpdateExpression;
    const isClock = node.type === AST_NODE_TYPES.CallExpression && VOLATILE_CALLS.has(source.getText(node.callee));
    return isCounter || isClock || (node.type === AST_NODE_TYPES.MemberExpression && source.getText(node) === target);
}

function isChangedEachRun(
    node: TSESTree.AssignmentExpression | TSESTree.UpdateExpression,
    target: string,
    source: TSESLint.SourceCode,
): boolean {
    if (node.type === AST_NODE_TYPES.UpdateExpression || node.operator !== '=') return true;
    const values = listBodyNodes(node.right, source);
    return source.getText(node.right) !== target && values.some((value) => isVolatile(value, target, source));
}

function isLoopingWrite(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    if (node.type !== AST_NODE_TYPES.AssignmentExpression && node.type !== AST_NODE_TYPES.UpdateExpression)
        return false;
    const target = getTarget(node.type === AST_NODE_TYPES.UpdateExpression ? node.argument : node.left, source);
    const isGuarded = listFunctionAncestors(node, source)
        .slice(1)
        .some((child) => child.parent !== undefined && isGuardStep(child.parent, child));
    return target !== undefined && !isGuarded && isChangedEachRun(node, target, source);
}

export const noVueUpdatedWrites = createRule<[], 'loop'>({
    name: 'no-vue-updated-writes',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an unguarded write to a Vue `ref` or `reactive` value in an `onUpdated` callback or an `updated` option when each run changes the value, such as an increment.',
            why: 'Vue runs the hook after each update, and the write schedules the next update, so the component loops until Vue stops it.',
            fix: 'Guard the write with a condition that stops changing the value, or move it to a watcher or an event callback.',
            example:
                '`onUpdated(() => { count.value++; })` reports `loop`. Write `onUpdated(() => { if (count.value < 3) count.value++; })`.',
        },
        schema: [],
        messages: {
            loop: 'Guard this write; changing reactive state in this hook on each update can start an infinite update loop.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const bodies = new Set<TSESTree.Node>();
        return {
            CallExpression(node) {
                const isHook = getModuleName(node.callee, source) === VUE_ON_UPDATED;
                const body = isHook ? getHookBody(node.arguments[0], source) : undefined;
                if (body !== undefined) bodies.add(body);
            },
            [VUE_OPTION_PROPERTIES]: (node: TSESTree.Property) => {
                const body = isUpdatedOption(node, source) ? getHookBody(node.value, source) : undefined;
                if (body !== undefined) bodies.add(body);
            },
            'Program:exit': () => {
                const writes = [...bodies].flatMap((body) => listBodyNodes(body, source));
                for (const node of writes)
                    if (isLoopingWrite(node, source)) context.report({ node, messageId: 'loop' });
            },
        };
    },
});
