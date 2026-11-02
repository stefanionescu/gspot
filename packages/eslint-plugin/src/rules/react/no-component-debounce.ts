import { createRule } from '../../rule.ts';
import { getModuleName } from '../../language/modules.ts';
import { isNamedFunction } from '../../libraries/react.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SPACES,
    REF_GUARD,
    REACT_CLASS,
    TIMER_WORDS,
    CACHING_HOOK,
    REACT_REF_HOOK,
    TIMER_FUNCTION,
    CLASS_OUTPUT_METHOD,
    STATEFUL_FUNCTION_NAME,
} from '../../config/react.ts';

function isRefCall(node: TSESTree.Node | null | undefined, source: TSESLint.SourceCode): boolean {
    const callee = node?.type === AST_NODE_TYPES.CallExpression ? node.callee : undefined;
    const name = callee === undefined ? undefined : getModuleName(callee, source);
    return name === REACT_REF_HOOK;
}

function getRefTarget(call: TSESTree.CallExpression): TSESTree.Identifier | undefined {
    const { parent } = call;
    const left =
        parent.type === AST_NODE_TYPES.AssignmentExpression && parent.operator === '=' ? parent.left : undefined;
    const isRefValue = left?.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(left) === 'current';
    return isRefValue && left.object.type === AST_NODE_TYPES.Identifier ? left.object : undefined;
}

function getGuard(statement: TSESTree.Node | undefined): TSESTree.Expression | undefined {
    const parent = statement?.parent;
    const branch = parent?.type === AST_NODE_TYPES.BlockStatement ? parent : statement;
    const owner = branch?.parent;
    return owner?.type === AST_NODE_TYPES.IfStatement && owner.consequent === branch ? owner.test : undefined;
}

function isRefVariable(ref: TSESTree.Identifier, source: TSESLint.SourceCode): boolean {
    const definition = ASTUtils.findVariable(source.getScope(ref), ref)?.defs.at(0)?.node;
    const init = definition?.type === AST_NODE_TYPES.VariableDeclarator ? definition.init : null;
    return isRefCall(init, source);
}

function isLazyRef(call: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const ref = getRefTarget(call);
    const test = getGuard(call.parent.parent);
    const guard =
        test === undefined || ref === undefined
            ? ''
            : source.getText(test).replaceAll(SPACES, '').replaceAll(`${ref.name}.current`, '§');
    return ref !== undefined && REF_GUARD.test(guard) && isRefVariable(ref, source);
}

function isExempt(call: TSESTree.CallExpression, callback: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const ancestors = source.getAncestors(call);
    const inner = ancestors.slice(ancestors.indexOf(callback) + 1);
    const isMemoized = inner.some(
        (ancestor) =>
            ancestor.type === AST_NODE_TYPES.CallExpression &&
            CACHING_HOOK.test(getModuleName(ancestor.callee, source) ?? source.getText(ancestor.callee)),
    );
    const isRefArgument = call.parent.type === AST_NODE_TYPES.CallExpression && call.parent.arguments[0] === call;
    return isMemoized || (isRefArgument && isRefCall(call.parent, source)) || isLazyRef(call, source);
}

function isReactClass(node: TSESTree.Node | undefined, source: TSESLint.SourceCode): boolean {
    const isClass = node?.type === AST_NODE_TYPES.ClassDeclaration || node?.type === AST_NODE_TYPES.ClassExpression;
    const base = isClass ? node.superClass : null;
    return base !== null && REACT_CLASS.test(getModuleName(base, source) ?? source.getText(base));
}

function getComponentKind(
    callback: TSESTree.Node,
    outputMethods: ReadonlySet<TSESTree.Node>,
): 'function' | 'class' | undefined {
    if (isNamedFunction(callback, STATEFUL_FUNCTION_NAME)) return 'function';
    return outputMethods.has(callback) ? 'class' : undefined;
}

function findComponentTimer(
    node: TSESTree.CallExpression,
    source: TSESLint.SourceCode,
    outputMethods: ReadonlySet<TSESTree.Node>,
): TSESLint.ReportDescriptor<'function' | 'class'> | undefined {
    const method = TIMER_FUNCTION.exec(getModuleName(node.callee, source) ?? '')?.[1];
    const words = TIMER_WORDS.get(method);
    if (words === undefined) return undefined;
    const callback = source.getAncestors(node).findLast((ancestor) => ASTUtils.isFunction(ancestor));
    if (callback === undefined) return undefined;
    const kind = getComponentKind(callback, outputMethods);
    if (kind === undefined || isExempt(node, callback, source)) return undefined;
    const report = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
    return { node: report, messageId: kind, data: words };
}

export const noComponentDebounce = createRule<[], 'function' | 'class'>({
    name: 'no-component-debounce',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a call of `debounce` or `throttle` from lodash, lodash-es, or Underscore.js in the body of a React function component or hook, a function whose name starts with an uppercase letter or with `use`, or in the `render` method of a React class component. A call inside `useMemo` or `useCallback`, passed to `useRef`, or assigned to `ref.current` behind a check that the ref is empty does not count.',
            why: 'The component calls the function again on each render, so each render creates a new timer, and the debounced or throttled function never waits as intended.',
            fix: 'Move the call out of the component, or keep the function across outputMethods with `useMemo`, `useRef`, or an instance property.',
            example:
                '`function Search() { const onChange = debounce(search, 300); }` reports `function`. Write `const onChange = useMemo(() => debounce(search, 300), [])`.',
        },
        schema: [],
        messages: {
            function:
                'This {{kind}} function is created again on each render, which resets its timer and defeats {{purpose}}. Move it out of the component or hook, or wrap it in `useMemo`.',
            class: 'This {{kind}} function is created again on each render, which resets its timer and defeats {{purpose}}. Create it in the constructor or as an instance property.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const outputMethods = new Set<TSESTree.Node>();
        return {
            [CLASS_OUTPUT_METHOD]: (node: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) => {
                if (isReactClass(node.parent.parent?.parent, source)) outputMethods.add(node);
            },
            CallExpression(node) {
                const timer = findComponentTimer(node, source, outputMethods);
                if (timer === undefined) return;
                context.report(timer);
            },
        };
    },
});
