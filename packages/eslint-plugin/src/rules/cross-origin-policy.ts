import { createRule } from '../rule.ts';
import { findFunction } from '../functions.ts';
import { readQualifiedName } from '../modules.ts';
import type { FunctionNode } from '../types/rules.ts';
import { readExpressionValue, readOptionProperties } from '../values.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    EXPRESS_MODULE,
    SERVER_FUNCTION,
    MIDDLEWARE_METHOD,
    EQUALITY_OPERATORS,
    ALLOW_ORIGIN_HEADER,
    CROSS_ORIGIN_MODULE,
    EXPRESS_ROUTE_METHODS,
    RESPONSE_CALL_ARGUMENTS,
} from '../config/servers.ts';

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
        if (call?.type !== AST_NODE_TYPES.CallExpression || call.callee.type !== AST_NODE_TYPES.MemberExpression)
            return [];
        const isMethod = call.arguments.length === RESPONSE_CALL_ARGUMENTS && !call.callee.computed;
        return isMethod && ASTUtils.getPropertyName(call.callee) === method ? [call] : [];
    });
}

function readText(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string | undefined {
    if (node === undefined) return undefined;
    const value = ASTUtils.getStaticValue(node, source.getScope(node))?.value;
    return typeof value === 'string' ? value : undefined;
}

function isCompared(identifier: TSESTree.Node): boolean {
    for (let node = identifier.parent; node !== undefined && !ASTUtils.isFunction(node); node = node.parent)
        if (node.type === AST_NODE_TYPES.BinaryExpression && EQUALITY_OPERATORS.has(node.operator)) return true;
    return false;
}

function isValidated(
    source: Readonly<TSESLint.SourceCode>,
    callback: FunctionNode,
    header: TSESTree.Node | undefined,
): boolean {
    if (header?.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = source.scopeManager?.acquire(callback)?.set.get(header.name);
    return (variable?.references ?? []).some(({ identifier }) => isCompared(identifier));
}

function isCopiedOrigin(
    source: Readonly<TSESLint.SourceCode>,
    call: TSESTree.CallExpression,
    request: string,
): boolean {
    const [name, header] = call.arguments;
    const value = readExpressionValue(header, source);
    if (readText(source, name)?.toLowerCase() !== ALLOW_ORIGIN_HEADER || value === undefined) return false;
    if (value.type === AST_NODE_TYPES.CallExpression)
        return (
            source.getText(value.callee) === `${request}.header` &&
            readText(source, value.arguments[0])?.toLowerCase() === 'origin'
        );
    return value.type === AST_NODE_TYPES.MemberExpression && source.getText(value) === `${request}.headers.origin`;
}

function listPermissiveServers(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const callback = findFunction(node.arguments[0], source);
    const calls = callback ? listResponseCalls(source, callback, 'writeHead') : [];
    return calls
        .filter((call) => {
            const headers = readExpressionValue(call.arguments[1], source);
            const origin =
                headers?.type === AST_NODE_TYPES.ObjectExpression
                    ? readOptionProperties(headers, source).get('Access-Control-Allow-Origin')
                    : null;
            return Boolean(origin) && readText(source, origin?.value) === '*';
        })
        .map(({ callee }) => callee);
}

function findOriginMiddleware(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): TSESTree.CallExpression | undefined {
    const middleware = readExpressionValue(node.arguments[0], source);
    if (middleware?.type !== AST_NODE_TYPES.CallExpression) return undefined;
    return readQualifiedName(middleware, source) === CROSS_ORIGIN_MODULE ? middleware : undefined;
}

function listPermissiveMiddlewares(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
): TSESTree.Node[] {
    const middleware = findOriginMiddleware(source, node);
    if (middleware?.arguments.length === 0) return [node];
    const options = readExpressionValue(middleware?.arguments[0], source);
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return [];
    const origin = readOptionProperties(options, source).get('origin');
    return origin && readText(source, origin.value) !== '*' ? [] : [node.callee];
}

function listCopiedOrigins(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const callback = findFunction(node.arguments[1], source);
    const request = callback?.params[0];
    if (callback === undefined || !ASTUtils.isIdentifier(request)) return [];
    return listResponseCalls(source, callback, 'setHeader')
        .filter(
            (call) => isCopiedOrigin(source, call, request.name) && !isValidated(source, callback, call.arguments[1]),
        )
        .map(({ callee }) => callee);
}

function listPermissiveNodes(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): TSESTree.Node[] {
    const name = readQualifiedName(node.callee, source) ?? '';
    const [module, method, ...members] = name.split('.');
    if (name === SERVER_FUNCTION) return listPermissiveServers(source, node);
    if (module !== EXPRESS_MODULE || members.length > 0) return [];
    if (method === MIDDLEWARE_METHOD) return listPermissiveMiddlewares(source, node);
    return EXPRESS_ROUTE_METHODS.has(method) ? listCopiedOrigins(source, node) : [];
}

export const crossOriginPolicy = createRule<[], 'permissive'>({
    name: 'cross-origin-policy',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds CORS policies that let any site read the responses: an `Access-Control-Allow-Origin` header of `*` in `http.createServer` handlers, the `crossOriginPolicy` middleware in `app.use` with no `origin` or an `origin` of `*`, and Express route handlers that copy the request `Origin` header into `Access-Control-Allow-Origin` without comparing it.',
            why: 'A permissive CORS policy lets any site read the responses that a signed-in user receives.',
            fix: 'Allow only the origins that need access: set `origin` to a list of trusted sites, and compare a request origin with that list before you send it back.',
            example:
                'The call `app.use(crossOriginPolicy())` reports `permissive`. Use `app.use(crossOriginPolicy({ origin: ["https://app.example.com"] }))`.',
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
