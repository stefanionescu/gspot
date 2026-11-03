import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { EQUALITY_OPERATORS } from '../../config/logic.ts';
import { findFunction } from '../../language/functions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { listArgumentValues, getExpressionValue, getOptionProperties } from '../../language/expressions.ts';

import {
    EXPRESS_MODULE,
    SERVER_FUNCTION,
    MIDDLEWARE_METHOD,
    ALLOW_ORIGIN_HEADER,
    CROSS_ORIGIN_MODULE,
    EXPRESS_ROUTE_METHODS,
    RESPONSE_CALL_ARGUMENTS,
} from '../../config/servers.ts';

function listResponseCalls(
    source: Readonly<TSESLint.SourceCode>,
    callback: FunctionNode,
    method: string,
): TSESTree.CallExpression[] {
    const [, response] = callback.params;
    const variable = source
        .getDeclaredVariables(callback)
        .find(({ name }) => ASTUtils.isIdentifier(response) && name === response.name);
    return (variable?.references ?? []).flatMap(({ identifier }) => {
        const call = identifier.parent.parent;
        const isMethod =
            call?.type === AST_NODE_TYPES.CallExpression &&
            call.callee.type === AST_NODE_TYPES.MemberExpression &&
            call.arguments.length === RESPONSE_CALL_ARGUMENTS &&
            !call.callee.computed &&
            ASTUtils.getPropertyName(call.callee) === method;
        return isMethod ? [call] : [];
    });
}

function getText(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string | undefined {
    const evaluated = node && ASTUtils.getStaticValue(node, source.getScope(node));
    if (typeof evaluated?.value !== 'string') return undefined;
    return evaluated.value;
}

function isCompared(identifier: TSESTree.Node): boolean {
    for (let node = identifier.parent; node !== undefined && !ASTUtils.isFunction(node); node = node.parent)
        if (node.type === AST_NODE_TYPES.BinaryExpression && EQUALITY_OPERATORS.has(node.operator)) return true;
    return false;
}

function isTestedArgument(identifier: TSESTree.Node): boolean {
    let child = identifier;
    let isArgument = false;
    for (let node = identifier.parent; node !== undefined && !ASTUtils.isFunction(node); node = node.parent) {
        isArgument ||= node.type === AST_NODE_TYPES.CallExpression && node.callee !== child;
        if ('test' in node && Object.is(node.test, child)) return isArgument;
        child = node;
    }
    return false;
}

function isValidated(source: Readonly<TSESLint.SourceCode>, header: TSESTree.Node | undefined): boolean {
    if (header?.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(source.getScope(header), header);
    return (
        variable?.references.some(({ identifier }) => isCompared(identifier) || isTestedArgument(identifier)) === true
    );
}

function isCopiedOrigin(
    source: Readonly<TSESLint.SourceCode>,
    call: TSESTree.CallExpression,
    request: string,
): boolean {
    const [name, header] = call.arguments;
    const value = getExpressionValue(header, source);
    if (value === undefined || getText(source, name)?.toLowerCase() !== ALLOW_ORIGIN_HEADER) return false;
    if (value.type === AST_NODE_TYPES.CallExpression)
        return (
            source.getText(value.callee) === `${request}.header` &&
            getText(source, value.arguments[0])?.toLowerCase() === 'origin'
        );
    return value.type === AST_NODE_TYPES.MemberExpression && source.getText(value) === `${request}.headers.origin`;
}

function listPermissiveServers(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const callback = findFunction(node.arguments[0], source);
    const calls = callback ? listResponseCalls(source, callback, 'writeHead') : [];
    return calls
        .filter((call) => {
            const origin = getOptionProperties(call.arguments[1], source).get('Access-Control-Allow-Origin');
            return getText(source, origin?.value) === '*';
        })
        .map(({ callee }) => callee);
}

function hasOpenOrigin(source: Readonly<TSESLint.SourceCode>, options: TSESTree.Node): boolean {
    const origin = getOptionProperties(options, source).get('origin');
    if (origin === undefined) return true;
    const value = ASTUtils.getStaticValue(origin.value, source.getScope(origin.value))?.value;
    return value === '*' || value === true;
}

function listPermissiveMiddlewares(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): TSESTree.Node[] {
    const middleware = listArgumentValues(node.arguments, source).find(
        (value): value is TSESTree.CallExpression =>
            value.type === AST_NODE_TYPES.CallExpression && getQualifiedName(value, source) === CROSS_ORIGIN_MODULE,
    );
    if (middleware?.arguments.length === 0) return [node];
    const options = getExpressionValue(middleware?.arguments[0], source);
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return [];
    return hasOpenOrigin(source, options) ? [node.callee] : [];
}

function listCopiedOrigins(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const callback = findFunction(node.arguments[1], source);
    const request = callback?.params[0];
    if (callback === undefined || !ASTUtils.isIdentifier(request)) return [];
    return listResponseCalls(source, callback, 'setHeader')
        .filter((call) => isCopiedOrigin(source, call, request.name) && !isValidated(source, call.arguments[1]))
        .map(({ callee }) => callee);
}

function listPermissiveNodes(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const name = (getQualifiedName(node.callee, source) ?? '').replace('.Router.', '.');
    const [module, method, ...members] = name.split('.');
    if (name === SERVER_FUNCTION) return listPermissiveServers(source, node);
    if (module !== EXPRESS_MODULE || members.length > 0) return [];
    if (method === MIDDLEWARE_METHOD) return listPermissiveMiddlewares(source, node);
    return EXPRESS_ROUTE_METHODS.has(method) ? listCopiedOrigins(source, node) : [];
}

export const noAnyOriginPolicy = createRule<[], 'permissive'>({
    name: 'no-any-origin-policy',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds CORS policies that let any site read the responses: an `Access-Control-Allow-Origin` of `*`, the `cors` middleware with no origin or an origin of `*` or `true`, and a handler that copies the request `Origin` unchecked.',
            why: 'A permissive CORS policy lets any site read the responses that a signed-in user receives.',
            fix: 'Allow only the origins that need access: set `origin` to a list of trusted sites, and compare a request origin with that list before you send it back.',
            example:
                'The call `app.use(cors())` reports `permissive`. Use `app.use(cors({ origin: ["https://app.example.com"] }))`.',
        },
        schema: [],
        messages: { permissive: 'Allow only trusted origins in this CORS policy.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const found = listPermissiveNodes(source, node);
                for (const permissive of found) context.report({ node: permissive, messageId: 'permissive' });
            },
        };
    },
});
