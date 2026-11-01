import { createRule } from '../rule.ts';
import { readModuleName } from '../modules.ts';
import { COOKIE_SECURITY_FLAGS, COOKIE_SET_OPTIONS_POSITION } from '../config/rules.ts';
import { readLiteralValue, readExpressionValue, readOptionProperties } from '../values.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readCookiesOptions(call: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    if (call.callee.type !== AST_NODE_TYPES.MemberExpression || ASTUtils.getPropertyName(call.callee) !== 'set')
        return undefined;
    const instance = readExpressionValue(call.callee.object, source);
    if (instance?.type !== AST_NODE_TYPES.NewExpression || readModuleName(instance.callee, source) !== 'cookies')
        return undefined;
    return call.arguments[COOKIE_SET_OPTIONS_POSITION];
}

function readCookieOptions(call: TSESTree.CallExpression, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const name = readModuleName(call.callee, source);
    if (name === 'cookie-session') return call.arguments[0];
    if (name !== 'express-session' && name !== 'csurf') return readCookiesOptions(call, source);
    return readOptionProperties(call.arguments[0], source).get('cookie')?.value;
}

export const noInsecureCookies = createRule<[], 'flag'>({
    name: 'no-insecure-cookies',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports explicitly disabled secure and HttpOnly cookie flags in session, CSRF, and cookie APIs.',
            why: 'Secure cookies stay on encrypted connections, and HttpOnly keeps browser scripts from reading them.',
            fix: 'Set secure and httpOnly to true. For csurf, configure cookie options explicitly instead of cookie: true.',
            example: '`session({ cookie: { secure: true, httpOnly: true } })` keeps both cookie protections enabled.',
        },
        schema: [],
        messages: { flag: 'Keep the {{flag}} cookie flag enabled.' },
    },
    create(context) {
        return {
            CallExpression(node) {
                const options = readCookieOptions(node, context.sourceCode);
                const implicit =
                    readModuleName(node.callee, context.sourceCode) === 'csurf' &&
                    readLiteralValue(options, context.sourceCode) === true;
                const properties = readOptionProperties(options, context.sourceCode);
                for (const flag of COOKIE_SECURITY_FLAGS) {
                    const property = properties.get(flag);
                    if (implicit || readLiteralValue(property?.value, context.sourceCode) === false)
                        context.report({ node: property ?? node.callee, messageId: 'flag', data: { flag } });
                }
            },
        };
    },
});
