import { createRule } from '../../rule.ts';
import { unwrapExpression } from '../../language/syntax.ts';
import { getQualifiedName } from '../../language/modules.ts';
import type { RequestDataCall, RequestDataTarget } from '../../types/security.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SQL_METHODS,
    FILE_METHODS,
    FILE_FUNCTION,
    REQUEST_NAMES,
    REQUEST_FIELDS,
    RESPONSE_NAMES,
    REQUEST_READERS,
    COMMAND_FUNCTION,
    RESPONSE_TARGETS,
    NUMBER_CONVERTERS,
    OUTBOUND_FUNCTIONS,
    COMMAND_INTERPRETERS,
} from '../../config/servers.ts';

function isRequestName(node: TSESTree.Node): boolean {
    return node.type === AST_NODE_TYPES.Identifier && REQUEST_NAMES.has(node.name);
}

function isRequestRead(node: TSESTree.Node): boolean {
    if (node.type === AST_NODE_TYPES.MemberExpression)
        return isRequestName(node.object) && REQUEST_FIELDS.has(ASTUtils.getPropertyName(node) ?? '');
    if (node.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression)
        return false;
    return isRequestName(node.callee.object) && REQUEST_READERS.has(ASTUtils.getPropertyName(node.callee) ?? '');
}

/**
Tell whether a variable holds request data: a declaration or an assignment in the same file sets it from an expression
that holds request data. A parameter of a function holds none, so the rule follows data within one function.
*/
function isTaintedVariable(identifier: TSESTree.Identifier, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    const variable = ASTUtils.findVariable(source.getScope(identifier), identifier);
    if (variable === null || seen.has(variable)) return false;
    seen.add(variable);
    const values = [
        ...variable.defs.flatMap(({ node }) =>
            node.type === AST_NODE_TYPES.VariableDeclarator && node.init !== null ? [node.init] : [],
        ),
        ...variable.references.flatMap(({ writeExpr }) =>
            writeExpr === null || writeExpr === undefined ? [] : [writeExpr],
        ),
    ];
    return values.some((value) => isTainted(value, source, seen));
}

function isTaintedCall(node: TSESTree.CallExpression, source: TSESLint.SourceCode, seen: Set<unknown>): boolean {
    if (isRequestRead(node)) return true;
    if (node.callee.type === AST_NODE_TYPES.Identifier && NUMBER_CONVERTERS.has(node.callee.name)) return false;
    const isMethodOfTainted =
        node.callee.type === AST_NODE_TYPES.MemberExpression && isTainted(node.callee.object, source, seen);
    return isMethodOfTainted || node.arguments.some((argument) => isTainted(argument, source, seen));
}

/**
Tell whether an expression holds request data: it reads a field of `req` or `request`, or it builds a value from one,
through a variable, a member, a template, a `+`, a condition, an `await`, or a call. A call to `Number` or `parseInt` returns no
request text.
*/
function isTainted(node: TSESTree.Node, source: TSESLint.SourceCode, seen: Set<unknown> = new Set()): boolean {
    let value = unwrapExpression(node);
    while (value.type === AST_NODE_TYPES.AwaitExpression) value = unwrapExpression(value.argument);
    switch (value.type) {
        case AST_NODE_TYPES.Identifier: {
            return isTaintedVariable(value, source, seen);
        }
        case AST_NODE_TYPES.MemberExpression: {
            return isRequestRead(value) || isTainted(value.object, source, seen);
        }
        case AST_NODE_TYPES.CallExpression: {
            return isTaintedCall(value, source, seen);
        }
        case AST_NODE_TYPES.TemplateLiteral: {
            return value.expressions.some((expression) => isTainted(expression, source, seen));
        }
        case AST_NODE_TYPES.BinaryExpression: {
            return value.operator === '+' && [value.left, value.right].some((side) => isTainted(side, source, seen));
        }
        case AST_NODE_TYPES.LogicalExpression: {
            return isTainted(value.left, source, seen) || isTainted(value.right, source, seen);
        }
        case AST_NODE_TYPES.ConditionalExpression: {
            return isTainted(value.consequent, source, seen) || isTainted(value.alternate, source, seen);
        }
        case AST_NODE_TYPES.ArrayExpression: {
            return value.elements.some((element) => element !== null && isTainted(element, source, seen));
        }
        default: {
            return false;
        }
    }
}

function hasRootOption(node: TSESTree.CallExpression): boolean {
    const options = node.arguments[1];
    return (
        options?.type === AST_NODE_TYPES.ObjectExpression &&
        options.properties.some(
            (property) => property.type === AST_NODE_TYPES.Property && ASTUtils.getPropertyName(property) === 'root',
        )
    );
}

function findResponseTarget(node: TSESTree.CallExpression): RequestDataTarget | undefined {
    const { callee } = node;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.object.type !== AST_NODE_TYPES.Identifier)
        return undefined;
    if (!RESPONSE_NAMES.has(callee.object.name)) return undefined;
    const target = RESPONSE_TARGETS[ASTUtils.getPropertyName(callee) ?? ''];
    return target === 'path' && hasRootOption(node) ? undefined : target;
}

function isInterpretedCommand(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const [program, commandArguments] = node.arguments;
    const name = program === undefined ? undefined : ASTUtils.getStaticValue(program, source.getScope(program))?.value;
    return COMMAND_INTERPRETERS.has(name) && commandArguments !== undefined && isTainted(commandArguments, source);
}

/**
Name the function that a call runs: its module and members, or the name of a global such as `fetch`.
*/
function getCalledName(node: TSESTree.CallExpression, source: TSESLint.SourceCode): string {
    const name = getQualifiedName(node.callee, source);
    if (name !== undefined) return name;
    return node.callee.type === AST_NODE_TYPES.Identifier ? node.callee.name : '';
}

function findModuleTarget(
    node: TSESTree.CallExpression,
    first: TSESTree.Node,
    source: TSESLint.SourceCode,
): RequestDataCall | undefined {
    const name = getCalledName(node, source);
    if (FILE_METHODS.has(FILE_FUNCTION.exec(name)?.groups?.['method'] ?? ''))
        return { target: 'path', argument: first };
    if (OUTBOUND_FUNCTIONS.has(name)) return { target: 'outbound', argument: first };
    return COMMAND_FUNCTION.test(name) && isInterpretedCommand(node, source)
        ? { target: 'shell', argument: node }
        : undefined;
}

function findMethodTarget(node: TSESTree.CallExpression, first: TSESTree.Node): RequestDataCall | undefined {
    const method =
        node.callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(node.callee) : undefined;
    // An inline template is gspot/no-dynamic-sql-queries territory, so this rule follows a query built in a variable.
    if (SQL_METHODS.has(method ?? '') && first.type === AST_NODE_TYPES.Identifier)
        return { target: 'sql', argument: first };
    return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'RegExp'
        ? { target: 'regexp', argument: first }
        : undefined;
}

/**
Name the place that a call passes request data to, and the argument that carries it. `res.redirect` takes the URL as
its last argument; the other calls take it first.
*/
function findCallTarget(node: TSESTree.CallExpression, source: TSESLint.SourceCode): RequestDataCall | undefined {
    const [first] = node.arguments;
    const response = findResponseTarget(node);
    if (response !== undefined) {
        const argument = response === 'redirect' ? node.arguments.at(-1) : first;
        return argument === undefined ? undefined : { target: response, argument };
    }
    if (first === undefined) return undefined;
    return findModuleTarget(node, first, source) ?? findMethodTarget(node, first);
}

export const noUncheckedRequestData = createRule<[], RequestDataTarget>({
    name: 'no-unchecked-request-data',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Follows a field of `req` or `request`, such as `req.query`, through the variables of one function, and reports it where it reaches a redirect, an HTML response, a view name, a file path, an outbound request, SQL text, a regular expression, a shell, or a property name.',
            why: 'Request data comes from the client, so in these places it opens a redirect, reflected XSS, a path traversal, a request forgery, SQL injection, a slow regular expression, command injection, or prototype pollution.',
            fix: 'Check the value against a fixed list, escape it for the place it goes, or pass it as a parameter, such as a query parameter in SQL.',
            example:
                '`const file = req.query.file; fs.readFile(path.join(root, file), done);` reports `path`. Look the file up by a key, or keep only `path.basename(file)`.',
        },
        schema: [],
        messages: {
            redirect:
                'The redirect target comes from the request, which allows an open redirect. Redirect only to a path of this site, or to a URL on an allowlist.',
            html: 'The response returns request data as HTML, which allows reflected XSS. Escape the value, or send JSON.',
            template:
                'The view name comes from the request, so a client can render any template. Pick the view from a fixed list.',
            path: 'A file path comes from the request, so `../` reaches any file the server can read. Look the file up by a key, or keep only path.basename().',
            outbound:
                'The server sends a request to a URL that the client chose, which reaches internal services. Allow only known hosts.',
            sql: 'The SQL text holds request data, which allows SQL injection. Pass the value as a query parameter.',
            regexp: 'A regular expression comes from the request, so a client can make it run for minutes. Escape the text, or match it without a regular expression.',
            shell: 'A shell runs a command that holds request data, which allows command injection. Pass the value as an argument, without a shell.',
            prototype:
                'A property name comes from the request, so `__proto__` changes every object. Check the name against a fixed list, or use a Map.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const found = findCallTarget(node, source);
                if (found !== undefined && (found.target === 'shell' || isTainted(found.argument, source)))
                    context.report({ node: found.argument, messageId: found.target });
            },
            NewExpression(node) {
                const [first] = node.arguments;
                const isRegExp = node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'RegExp';
                if (isRegExp && first !== undefined && isTainted(first, source))
                    context.report({ node: first, messageId: 'regexp' });
            },
            AssignmentExpression(node) {
                const target = node.left;
                if (
                    target.type === AST_NODE_TYPES.MemberExpression &&
                    target.computed &&
                    isTainted(target.property, source)
                )
                    context.report({ node: target.property, messageId: 'prototype' });
            },
        };
    },
});
