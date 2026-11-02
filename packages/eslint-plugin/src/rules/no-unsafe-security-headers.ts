import { createRule } from '../rule.ts';
import { getModuleName } from '../modules.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getLiteralValue, listArgumentValues, getExpressionValue, getOptionProperties } from '../expressions.ts';

import {
    MINIMUM_HSTS_AGE,
    POWERED_BY_FACTORIES,
    UNSAFE_REFERRER_POLICIES,
    DISABLED_SECURITY_HEADERS,
} from '../config/security.ts';

function isApplication(identifier: TSESTree.Identifier, source: TSESLint.SourceCode): boolean {
    const variable = ASTUtils.findVariable(source.getScope(identifier), identifier);
    return (
        variable?.defs.some((definition) => {
            if (definition.type === TSESLint.Scope.DefinitionType.Parameter) return identifier.name === 'app';
            const init = definition.node.type === AST_NODE_TYPES.VariableDeclarator ? definition.node.init : null;
            if (init?.type !== AST_NODE_TYPES.CallExpression) return false;
            const name = getModuleName(init.callee, source);
            return name !== undefined && POWERED_BY_FACTORIES.has(name);
        }) === true
    );
}

function listMiddleware(
    node: TSESTree.Node,
    source: TSESLint.SourceCode,
    seen = new Set<TSESTree.Node>(),
): TSESTree.CallExpression[] {
    const value = getExpressionValue(node, source);
    if (value === undefined || seen.has(value)) return [];
    seen.add(value);
    if (value.type === AST_NODE_TYPES.CallExpression) return [value];
    if (value.type === AST_NODE_TYPES.SpreadElement) return listMiddleware(value.argument, source, seen);
    if (value.type !== AST_NODE_TYPES.ArrayExpression) return [];
    return value.elements
        .filter((element) => element !== null)
        .flatMap((element) => listMiddleware(element, source, new Set(seen)));
}

function hasUnsafeReferrerPolicy(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    return listArgumentValues([node], source).some((policy) => {
        const literal = getLiteralValue(policy, source);
        return typeof literal === 'string' && UNSAFE_REFERRER_POLICIES.has(literal);
    });
}

function listUnsafeOptions(call: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Property[] {
    if (call.arguments.length !== 1) return [];
    const name = getModuleName(call.callee, source);
    const properties = getOptionProperties(call.arguments[0], source);
    if (name === 'helmet')
        return [...properties.values()].filter((property) => {
            const key = ASTUtils.getPropertyName(property, source.getScope(property));
            return (
                key !== null && DISABLED_SECURITY_HEADERS.has(key) && getLiteralValue(property.value, source) === false
            );
        });
    if (name === 'helmet.referrerPolicy') {
        const policy = properties.get('policy');
        return policy !== undefined && hasUnsafeReferrerPolicy(policy.value, source) ? [policy] : [];
    }
    if (name !== 'helmet.hsts' && name !== 'hsts') return [];
    return [...properties.values()].filter((property) => {
        const key = ASTUtils.getPropertyName(property, source.getScope(property));
        const value = getLiteralValue(property.value, source);
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
                            data: { option: context.sourceCode.getText(option.key) },
                        });
            },
        };
    },
});
