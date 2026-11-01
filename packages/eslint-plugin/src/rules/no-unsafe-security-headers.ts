import { createRule } from '../rule.ts';
import { readModuleName } from '../modules.ts';
import { readLiteralValue, readExpressionValue, readOptionProperties } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    MINIMUM_HSTS_AGE,
    POWERED_BY_FACTORIES,
    UNSAFE_REFERRER_POLICIES,
    DISABLED_SECURITY_HEADERS,
} from '../config/security.ts';

function isModuleExport(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
    if (node.object.type === AST_NODE_TYPES.Identifier)
        return node.object.name === 'module' && ASTUtils.getPropertyName(node) === 'exports';
    return isModuleExport(node.object);
}

function isInjectedApplication(node: TSESTree.Node, name: string): boolean {
    if (name !== 'app' || node.parent?.type !== AST_NODE_TYPES.AssignmentExpression) return false;
    return isModuleExport(node.parent.left);
}

function isApplication(identifier: TSESTree.Identifier, source: TSESLint.SourceCode): boolean {
    const variable = ASTUtils.findVariable(source.getScope(identifier), identifier);
    return (
        variable?.defs.some((definition) => {
            if (definition.node.range[0] > identifier.range[0]) return false;
            if (definition.node.type !== AST_NODE_TYPES.VariableDeclarator)
                return isInjectedApplication(definition.node, identifier.name);
            if (definition.node.init?.type !== AST_NODE_TYPES.CallExpression) return false;
            const name = readModuleName(definition.node.init.callee, source);
            return name !== undefined && POWERED_BY_FACTORIES.has(name);
        }) ?? false
    );
}

function listMiddleware(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): TSESTree.CallExpression[] {
    const value = readExpressionValue(node, source);
    if (value === undefined || seen.has(value)) return [];
    seen.add(value);
    if (value.type === AST_NODE_TYPES.CallExpression) return [value];
    if (value.type === AST_NODE_TYPES.SpreadElement) return listMiddleware(value.argument, source, seen);
    if (value.type !== AST_NODE_TYPES.ArrayExpression) return [];
    return value.elements.flatMap((element) =>
        element === null ? [] : listMiddleware(element, source, new Set(seen)),
    );
}

function hasUnsafeReferrerPolicy(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const value = readExpressionValue(node, source);
    const values = value?.type === AST_NODE_TYPES.ArrayExpression ? value.elements : [value];
    return values.some((policy) => {
        const literal = readLiteralValue(policy ?? undefined, source);
        return typeof literal === 'string' && UNSAFE_REFERRER_POLICIES.has(literal);
    });
}

function listUnsafeOptions(call: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Property[] {
    if (call.arguments.length !== 1) return [];
    const name = readModuleName(call.callee, source);
    const properties = readOptionProperties(call.arguments[0], source);
    if (name === 'helmet')
        return [...properties.values()].filter((property) => {
            const key = ASTUtils.getPropertyName(property, source.getScope(property));
            return (
                key !== null && DISABLED_SECURITY_HEADERS.has(key) && readLiteralValue(property.value, source) === false
            );
        });
    if (name === 'helmet.referrerPolicy') {
        const policy = properties.get('policy');
        return policy !== undefined && hasUnsafeReferrerPolicy(policy.value, source) ? [policy] : [];
    }
    if (name !== 'helmet.hsts' && name !== 'hsts') return [];
    return [...properties.values()].filter((property) => {
        const key = ASTUtils.getPropertyName(property, source.getScope(property));
        const value = readLiteralValue(property.value, source);
        return (
            (key === 'includeSubDomains' && value === false) ||
            (key === 'maxAge' && typeof value === 'number' && value < MINIMUM_HSTS_AGE)
        );
    });
}

export const noUnsafeSecurityHeaders = createRule<[], 'header'>({
    name: 'no-unsafe-security-headers',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports disabled Helmet security headers and unsafe referrer or HSTS settings in Express middleware.',
            why: 'These headers restrict browser access, prevent MIME guessing, and require encrypted connections.',
            fix: 'Keep the Helmet defaults. Use a restrictive referrer policy and HSTS for at least six months with subdomains included.',
            example: '`app.use(helmet());` keeps the default security headers enabled.',
        },
        schema: [],
        messages: { header: 'Keep {{option}} protective: use the Helmet default or a restrictive policy.' },
    },
    create(context) {
        return {
            CallExpression(node) {
                const { callee } = node;
                if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.object.type !== AST_NODE_TYPES.Identifier)
                    return;
                if (ASTUtils.getPropertyName(callee) !== 'use' || !isApplication(callee.object, context.sourceCode))
                    return;
                for (const middleware of node.arguments.flatMap((argument) =>
                    listMiddleware(argument, context.sourceCode),
                ))
                    for (const option of listUnsafeOptions(middleware, context.sourceCode))
                        context.report({
                            node: option,
                            messageId: 'header',
                            data: { option: ASTUtils.getPropertyName(option) ?? 'this setting' },
                        });
            },
        };
    },
});
