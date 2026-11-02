import { createRule } from '../../rule.ts';
import type { FunctionNode } from '../../types/plugin.ts';
import { findFunction } from '../../language/functions.ts';
import { getQualifiedName } from '../../language/modules.ts';
import type { EscapingSetting } from '../../types/security.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { ESCAPING_CALLS, MUSTACHE_ESCAPE, MUSTACHE_GLOBAL, ESCAPING_CONSTRUCTIONS } from '../../config/security.ts';

function isEscapingOff(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    settings: Readonly<Record<string, EscapingSetting>>,
): boolean {
    const name = getQualifiedName(node, source) ?? '';
    const setting = Object.hasOwn(settings, name) ? settings[name] : undefined;
    if (setting === undefined) return false;
    const options = getExpressionValue(node.arguments[setting.argument], source);
    const property =
        options?.type === AST_NODE_TYPES.ObjectExpression
            ? getOptionProperties(options, source).get(setting.property)
            : null;
    return property ? ASTUtils.getStaticValue(property.value, source.getScope(node))?.value === setting.value : false;
}

function getReturnedValue(escape: FunctionNode): TSESTree.Node | null {
    if (escape.body.type !== AST_NODE_TYPES.BlockStatement) return escape.body;
    const [statement, ...rest] = escape.body.body;
    return rest.length === 0 && statement?.type === AST_NODE_TYPES.ReturnStatement ? statement.argument : null;
}

function isIdentityFunction(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): boolean {
    const escape = findFunction(node, source);
    const [parameter, ...others] = escape?.params ?? [];
    if (escape === undefined || !ASTUtils.isIdentifier(parameter) || others.length > 0) return false;
    const result = getReturnedValue(escape);
    return ASTUtils.isIdentifier(result) && result.name === parameter.name;
}

export const disabledAutoEscaping = createRule<[], 'unescaped'>({
    name: 'disabled-auto-escaping',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds template and Markdown options that turn off HTML escaping: `noEscape: true` in `handlebars.compile`, `sanitize: false` in `marked.setOptions` and `kramed.Renderer`, `html: true` in `markdown-it`, `autoescape: false` in `swig.setDefaults`, and a `Mustache.escape` that returns its input unchanged.',
            why: 'Without escaping, a value that holds HTML runs as markup in the page, so an attacker can inject scripts.',
            fix: 'Keep the escaping on. Mark only reviewed markup as safe, one value at a time.',
            example:
                'The call `Handlebars.compile(source, { noEscape: true })` reports `unescaped`. Use `Handlebars.compile(source)`.',
        },
        schema: [],
        messages: { unescaped: 'Keep auto-escaping on here, so that values cannot inject markup.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const isOff = isEscapingOff(source, node, ESCAPING_CALLS);
                if (isOff) context.report({ node: node.callee, messageId: 'unescaped' });
            },
            NewExpression(node) {
                const isOff = isEscapingOff(source, node, ESCAPING_CONSTRUCTIONS);
                if (isOff) context.report({ node: node.callee, messageId: 'unescaped' });
            },
            'AssignmentExpression[left.type="MemberExpression"]'(node: TSESTree.AssignmentExpression) {
                const target = node.left as TSESTree.MemberExpression;
                const isMustache =
                    getQualifiedName(target, source) === MUSTACHE_ESCAPE ||
                    (ASTUtils.isIdentifier(target.object) &&
                        target.object.name === MUSTACHE_GLOBAL &&
                        ASTUtils.getPropertyName(target) === 'escape');
                if (isMustache && isIdentityFunction(source, node.right))
                    context.report({ node: target, messageId: 'unescaped' });
            },
        };
    },
});
