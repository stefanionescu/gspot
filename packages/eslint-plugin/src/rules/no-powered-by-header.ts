import { createRule } from '../rule.ts';
import { readModuleName } from '../modules.ts';
import { listArgumentValues } from '../expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    POWERED_BY_HEADER,
    POWERED_BY_FACTORIES,
    POWERED_BY_MIDDLEWARE,
    POWERED_BY_SET_ARGUMENTS,
} from '../config/security.ts';

function protectsHeader(node: TSESTree.CallExpressionArgument, source: TSESLint.SourceCode): boolean {
    const value = node.type === AST_NODE_TYPES.SpreadElement ? node.argument : node;
    return listArgumentValues([value], source).some((middleware) => {
        const name =
            middleware.type === AST_NODE_TYPES.CallExpression ? readModuleName(middleware.callee, source) : undefined;
        return name !== undefined && POWERED_BY_MIDDLEWARE.has(name);
    });
}

function disablesHeader(call: TSESTree.CallExpression, method: string | null, source: TSESLint.SourceCode): boolean {
    if (method === 'use') return call.arguments.some((argument) => protectsHeader(argument, source));
    const [header, enabled] = call.arguments.map((argument) => ASTUtils.getStaticValue(argument)?.value);
    if (String(header).toLowerCase() !== POWERED_BY_HEADER) return false;
    if (method === 'disable' && call.arguments.length === 1) return true;
    return method === 'set' && call.arguments.length === POWERED_BY_SET_ARGUMENTS && enabled === false;
}

function isProtected(variable: TSESLint.Scope.Variable, source: TSESLint.SourceCode, creationOffset: number): boolean {
    return variable.references
        .filter(({ identifier }) => identifier.range[0] > creationOffset)
        .some(({ identifier }) => {
            const { parent } = identifier;
            if (parent.type === AST_NODE_TYPES.ReturnStatement) return true;
            if (parent.type === AST_NODE_TYPES.CallExpression) return parent.callee.range[0] !== identifier.range[0];
            if (parent.type !== AST_NODE_TYPES.MemberExpression || parent.object.range[0] !== identifier.range[0])
                return false;
            const call = parent.parent;
            return (
                call.type === AST_NODE_TYPES.CallExpression &&
                call.callee === parent &&
                disablesHeader(call, ASTUtils.getPropertyName(parent), source)
            );
        });
}

export const noPoweredByHeader = createRule<[], 'header'>({
    name: 'no-powered-by-header',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Requires an Express application to disable its X-Powered-By header.',
            why: 'The default response header tells clients which server framework handles their requests.',
            fix: "Call app.disable('x-powered-by') after creating the application, or install middleware that removes the header.",
            example: "`const app = express(); app.disable('x-powered-by');` disables the framework header.",
        },
        schema: [],
        messages: {
            header: "Disable the framework header with app.disable('x-powered-by') after creating this application.",
        },
    },
    create(context) {
        const applications: TSESTree.VariableDeclarator[] = [];
        return {
            VariableDeclarator(node) {
                if (node.id.type !== AST_NODE_TYPES.Identifier || node.init?.type !== AST_NODE_TYPES.CallExpression)
                    return;
                const name = readModuleName(node.init.callee, context.sourceCode);
                if (name !== undefined && POWERED_BY_FACTORIES.has(name)) applications.push(node);
            },
            'Program:exit'() {
                for (const declaration of applications) {
                    const variables = context.sourceCode.getDeclaredVariables(declaration);
                    if (
                        !variables.some((variable) =>
                            isProtected(variable, context.sourceCode, declaration.id.range[0]),
                        )
                    )
                        context.report({ node: declaration.id, messageId: 'header' });
                }
            },
        };
    },
});
