import { createRule } from '../rule.ts';
import { getTypes } from '../checker.ts';
import { findFunction } from '../functions.ts';
import type { TypeReader } from '../types/plugin.ts';
import type { FunctionNode } from '../types/rules.ts';
import { getExpressionValue, findAssignedVariable } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

import {
    WINDOW_TOKEN,
    MESSAGE_EVENT,
    ORIGIN_MEMBER,
    UNTYPED_TYPES,
    WINDOW_MEMBERS,
    DOM_LIBRARY_FILE,
    WINDOW_RECEIVERS,
    ANY_TARGET_ORIGIN,
    ON_MESSAGE_SELECTOR,
    JQUERY_EVENT_MEMBER,
    COMPARED_EVENT_DEPTH,
    POST_MESSAGE_SELECTOR,
    ADD_LISTENER_SELECTOR,
    COMPARED_ORIGIN_DEPTH,
    MESSAGE_LISTENER_PROPERTY,
} from '../config/web.ts';

function isInIfStatement(node: TSESTree.Node): boolean {
    let ancestor = node.parent;
    while (ancestor !== undefined && ancestor.type !== AST_NODE_TYPES.IfStatement && !ASTUtils.isFunction(ancestor))
        ancestor = ancestor.parent;
    return ancestor?.type === AST_NODE_TYPES.IfStatement;
}

function isNameCompared(source: TSESLint.SourceCode, logical: TSESTree.Node, levels: number): boolean {
    const variable = findAssignedVariable(logical, source);
    const targets = (variable?.references ?? []).map(({ identifier }) =>
        levels === COMPARED_ORIGIN_DEPTH ? identifier.parent : identifier.parent.parent,
    );
    return targets.some((target) => target !== undefined && isInIfStatement(target));
}

function isUnionVerified(
    source: Readonly<TSESLint.SourceCode>,
    member: TSESTree.MemberExpression,
    jqueryEvents: ReadonlySet<TSESTree.Node>,
): boolean {
    const logical = member.parent;
    if (logical.type !== AST_NODE_TYPES.LogicalExpression) return false;
    const other = logical.left === member ? logical.right : logical.left;
    const isJqueryOrigin =
        other.type === AST_NODE_TYPES.MemberExpression &&
        jqueryEvents.has(other.object) &&
        ASTUtils.getPropertyName(other) === ORIGIN_MEMBER;
    return isJqueryOrigin && isNameCompared(source, logical, COMPARED_ORIGIN_DEPTH);
}

function isMemberVerified(
    source: Readonly<TSESLint.SourceCode>,
    member: TSESTree.MemberExpression,
    jqueryEvents: ReadonlySet<TSESTree.Node>,
): boolean {
    const outer = member.parent;
    const isJqueryOrigin =
        jqueryEvents.has(member) &&
        outer.type === AST_NODE_TYPES.MemberExpression &&
        ASTUtils.getPropertyName(outer) === ORIGIN_MEMBER;
    const isOrigin = ASTUtils.getPropertyName(member) === ORIGIN_MEMBER;
    if ((isOrigin || isJqueryOrigin) && isInIfStatement(member)) return true;
    return (
        (isOrigin && isNameCompared(source, member, COMPARED_ORIGIN_DEPTH)) ||
        isUnionVerified(source, member, jqueryEvents)
    );
}

function isEventVerified(
    source: Readonly<TSESLint.SourceCode>,
    identifier: TSESTree.Node,
    jqueryEvents: ReadonlySet<TSESTree.Node>,
): boolean {
    const { parent } = identifier;
    switch (parent?.type) {
        case AST_NODE_TYPES.MemberExpression: {
            return isMemberVerified(source, parent, jqueryEvents);
        }
        case AST_NODE_TYPES.VariableDeclarator: {
            return source
                .getDeclaredVariables(parent)
                .filter(({ defs }) => {
                    const property = defs[0]?.name.parent;
                    const isProperty = property?.type === AST_NODE_TYPES.Property;
                    return isProperty && ASTUtils.getPropertyName(property) === ORIGIN_MEMBER;
                })
                .some(({ references }) => references.some(({ identifier: read }) => isInIfStatement(read)));
        }
        case AST_NODE_TYPES.LogicalExpression: {
            const other = parent.left === identifier ? parent.right : parent.left;
            return jqueryEvents.has(other) && isNameCompared(source, parent, COMPARED_EVENT_DEPTH);
        }
        default: {
            return false;
        }
    }
}

function isOriginVerified(
    source: Readonly<TSESLint.SourceCode>,
    listener: FunctionNode,
    event: TSESTree.Identifier,
): boolean {
    const variable = source.getDeclaredVariables(listener).find(({ name }) => name === event.name);
    const identifiers: TSESTree.Node[] = variable?.references.map(({ identifier }) => identifier) ?? [];
    const jqueryEvents = new Set(
        identifiers.flatMap(({ parent }) =>
            parent?.type === AST_NODE_TYPES.MemberExpression &&
            identifiers.includes(parent.object) &&
            ASTUtils.getPropertyName(parent) === JQUERY_EVENT_MEMBER
                ? [parent]
                : [],
        ),
    );
    return identifiers.some((identifier) => isEventVerified(source, identifier, jqueryEvents));
}

function isWindow(source: Readonly<TSESLint.SourceCode>, types: TypeReader, node: TSESTree.Node): boolean {
    const type = types.get(node);
    const members = type.isUnionOrIntersection() ? type.types : [type];
    if (!UNTYPED_TYPES.has(types.checker.typeToString(type)))
        return members.some((member) => WINDOW_MEMBERS.every((name) => member.getProperty(name) !== undefined));
    return source
        .getTokens(node)
        .some(({ type: kind, value }) => kind === AST_TOKEN_TYPES.Identifier && WINDOW_TOKEN.test(value));
}

function isDomReceiver(source: Readonly<TSESLint.SourceCode>, types: TypeReader, node: TSESTree.Node): boolean {
    const receiver = getExpressionValue(node, source) ?? node;
    const messageProperty =
        ASTUtils.isIdentifier(receiver) && WINDOW_RECEIVERS.has(receiver.name)
            ? types.get(receiver).getProperty(MESSAGE_LISTENER_PROPERTY)
            : undefined;
    return (
        messageProperty?.declarations?.some((declaration) =>
            declaration.getSourceFile().fileName.endsWith(DOM_LIBRARY_FILE),
        ) === true
    );
}

function findMessageListener(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
): FunctionNode | undefined {
    const listener = findFunction(node, source);
    if (listener?.body.type === AST_NODE_TYPES.CallExpression) return undefined;
    return listener;
}

export const noAnyOriginMessages = createRule<[], 'anyTarget' | 'unverifiedOrigin'>({
    name: 'no-any-origin-messages',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'In files with TypeScript type information, finds `postMessage` calls on a window with the target origin `*`, and `message` listeners on a window, through `addEventListener` or `onmessage`, that never compare `event.origin` in an `if` statement.',
            why: 'A message sent to `*` reaches any page that the window shows, and a listener that does not check the origin accepts messages from any site.',
            fix: 'Pass the exact origin of the receiver to `postMessage`, and return early in the listener when `event.origin` is not a trusted origin.',
            example:
                'The call `frame.contentWindow.postMessage(data, "*")` reports `anyTarget`. Use `frame.contentWindow.postMessage(data, "https://app.example.com")`.',
        },
        schema: [],
        messages: {
            anyTarget: 'Specify the target origin of this message.',
            unverifiedOrigin: 'Verify the origin of the received message.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        const checkListener = (node: TSESTree.Node | undefined, report: TSESTree.Node): void => {
            const listener = findMessageListener(source, node);
            const event = listener?.params[0];
            if (listener && ASTUtils.isIdentifier(event) && !isOriginVerified(source, listener, event))
                context.report({ node: report, messageId: 'unverifiedOrigin' });
        };
        return {
            [POST_MESSAGE_SELECTOR](node: TSESTree.CallExpression) {
                const target = getExpressionValue(node.arguments[1], source);
                const isAny = target?.type === AST_NODE_TYPES.Literal && target.value === ANY_TARGET_ORIGIN;
                const { callee } = node;
                if (
                    isAny &&
                    (callee.type === AST_NODE_TYPES.Identifier ||
                        (callee.type === AST_NODE_TYPES.MemberExpression && isWindow(source, types, callee.object)))
                )
                    context.report({ node: callee, messageId: 'anyTarget' });
            },
            [ADD_LISTENER_SELECTOR](node: TSESTree.CallExpression) {
                const callee = node.callee as TSESTree.MemberExpression;
                const [type, listener] = node.arguments;
                const event = getExpressionValue(type, source);
                const isMessage =
                    event?.type === AST_NODE_TYPES.Literal &&
                    typeof event.value === 'string' &&
                    event.value.toLowerCase() === MESSAGE_EVENT;
                if (isMessage && isWindow(source, types, callee.object)) checkListener(listener, callee);
            },
            [ON_MESSAGE_SELECTOR](node: TSESTree.AssignmentExpression) {
                const target = node.left as TSESTree.MemberExpression;
                const isReceiver = isDomReceiver(source, types, target.object);
                if (isReceiver) checkListener(node.right, target);
            },
        };
    },
});
