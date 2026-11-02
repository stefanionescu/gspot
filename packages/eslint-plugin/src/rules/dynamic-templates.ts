import { createRule } from '../rule.ts';
import { readQualifiedName } from '../modules.ts';
import { isDynamicString } from '../expressions.ts';
import { TEMPLATE_FUNCTIONS } from '../config/servers.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isCompiledTemplateCall(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): boolean {
    if (node.callee.type !== AST_NODE_TYPES.Identifier) return false;
    const variable = ASTUtils.findVariable(source.getScope(node.callee), node.callee);
    if (variable === null || variable.defs.some(({ type }) => type === TSESLint.Scope.DefinitionType.ImportBinding))
        return false;
    const writes = variable.references.filter((reference) => reference.isWrite());
    return writes.length === 1 && writes[0]?.writeExpr?.type === AST_NODE_TYPES.CallExpression;
}

function isBuiltTemplate(template: TSESTree.CallExpressionArgument): boolean {
    if (template.type === AST_NODE_TYPES.BinaryExpression && template.operator === '+')
        return isDynamicString(template);
    return template.type === AST_NODE_TYPES.TemplateLiteral
        ? template.expressions.length > 0
        : template.type !== AST_NODE_TYPES.Literal;
}

export const dynamicTemplates = createRule<[], 'builtTemplate'>({
    name: 'dynamic-templates',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `compile` and `render` calls of `pug` and `ejs` whose template text is not a literal: a template literal with an expression, a concatenation with a computed part, or any other value that is not written in the code.',
            why: 'A template engine runs the code inside a template, so a template built from input lets an attacker run code on the server.',
            fix: 'Keep templates in fixed files or constants, and pass the values as template data.',
            example:
                'The call ``pug.render(`p Hello ${name}`)`` reports `builtTemplate`. Use `pug.render("p Hello #{name}", { name })`.',
        },
        schema: [],
        messages: { builtTemplate: 'Pass the values of this template as data, not inside the template text.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[arguments.length>0]'(
                node: TSESTree.CallExpression & { arguments: [TSESTree.CallExpressionArgument] },
            ) {
                const [template] = node.arguments;
                const name = readQualifiedName(node, source);
                if (isBuiltTemplate(template) && TEMPLATE_FUNCTIONS.has(name) && !isCompiledTemplateCall(source, node))
                    context.report({ node: node.callee, messageId: 'builtTemplate' });
            },
        };
    },
});
