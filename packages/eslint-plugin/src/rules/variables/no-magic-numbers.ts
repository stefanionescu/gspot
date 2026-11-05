import { createRequire } from 'node:module';

import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { FUNCTION_NODES } from '../../config/plugin.ts';
import { MAGIC_NUMBER_OPTIONS_SCHEMA, TABLE_CONSTRUCTORS, UPSTREAM_RULE } from '../../config/variables.ts';
import { createRule } from '../../rule.ts';
import type { MagicNumbersOptions } from '../../types/variables.ts';

const require = createRequire(import.meta.url);

function isModuleConstant(declaration: TSESTree.VariableDeclaration): boolean {
    if (declaration.kind !== 'const') return false;
    const holder =
        declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
            ? declaration.parent.parent
            : declaration.parent;
    return holder.type === AST_NODE_TYPES.Program;
}

function isCallArgument(node: TSESTree.Node): boolean {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.CallExpression && parent?.type !== AST_NODE_TYPES.NewExpression) return false;
    const isTable =
        parent.type === AST_NODE_TYPES.NewExpression &&
        parent.callee.type === AST_NODE_TYPES.Identifier &&
        TABLE_CONSTRUCTORS.has(parent.callee.name);
    return !isTable && parent.arguments.includes(node as TSESTree.CallExpressionArgument);
}

function isSplitLimit(node: TSESTree.Node): boolean {
    const call = node.parent;
    if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments[1] !== node) return false;
    const { callee } = call;
    return (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === 'split'
    );
}

function findArrayPattern(node: TSESTree.Node, child: TSESTree.Node): TSESTree.ArrayPattern | undefined {
    if (node.type === AST_NODE_TYPES.VariableDeclarator && node.init === child)
        return node.id.type === AST_NODE_TYPES.ArrayPattern ? node.id : undefined;
    if (node.type === AST_NODE_TYPES.AssignmentExpression && node.right === child)
        return node.left.type === AST_NODE_TYPES.ArrayPattern ? node.left : undefined;
    return undefined;
}

function isPatternSize(node: TSESTree.Node): boolean {
    if (node.type !== AST_NODE_TYPES.Literal || typeof node.value !== 'number') return false;
    let child: TSESTree.Node = node;
    for (let ancestor = node.parent; !FUNCTION_NODES.has(ancestor.type); ancestor = ancestor.parent) {
        const pattern = findArrayPattern(ancestor, child);
        if (pattern !== undefined) return pattern.elements.length === node.value;
        if (ancestor.type === AST_NODE_TYPES.Program || ancestor.type.endsWith('Statement')) return false;
        child = ancestor;
    }
    return false;
}

function isConstantValue(node: TSESTree.Node): boolean {
    for (let ancestor: TSESTree.Node = node; ancestor.type !== AST_NODE_TYPES.Program; ancestor = ancestor.parent) {
        if (FUNCTION_NODES.has(ancestor.type) || isCallArgument(ancestor)) return false;
        if (ancestor.type === AST_NODE_TYPES.VariableDeclarator) return isModuleConstant(ancestor.parent);
    }
    return false;
}

export const noMagicNumbers = createRule<MagicNumbersOptions, 'noMagic' | 'useConst'>({
    name: 'no-magic-numbers',
    meta: {
        defaultOptions: [{}],
        type: 'suggestion',
        docs: {
            example:
                'The call `setTimeout(retry, 3000)` reports `noMagic`. Name the delay, such as `const RETRY_DELAY_MS = 3000;` at module level, and pass the constant. `const SIZES = [16, 32, 64];` and `const TIMEOUT_MS = 60 * 1000;` pass, because the constant names its numbers. `export const server = app.listen(8080);` reports `noMagic`, because `server` names the server, not the port. `const [key, value] = line.split("=", 2);` passes, because the two names give the split limit its meaning.',
            level: 'none',
            description:
                'Reports the numbers that @typescript-eslint/no-magic-numbers reports, except in the value of a module-level `const`, a `split` limit, or a size that a destructuring pattern names. It takes the options of that rule and needs it installed.',
            why: 'A bare number hides what it measures, and a module-level constant gives it a name that callers share.',
            fix: 'Move the number into a module-level constant whose name says what it measures.',
        },
        schema: [MAGIC_NUMBER_OPTIONS_SCHEMA],
        messages: {
            noMagic: 'No magic number: {{raw}}. Name it in a module-level constant.',
            useConst: 'Declare this number with const at module level, and name it.',
        },
    },
    create(context) {
        const upstream = require('@typescript-eslint/eslint-plugin') as {
            rules: Record<
                typeof UPSTREAM_RULE,
                TSESLint.RuleModule<string, MagicNumbersOptions> & { meta: { defaultOptions: MagicNumbersOptions } }
            >;
        };
        const rule = upstream.rules[UPSTREAM_RULE];
        return rule.create(
            Object.create(context, {
                options: { value: ESLintUtils.applyDefault(rule.meta.defaultOptions, context.options) },
                report: {
                    value: (descriptor: TSESLint.ReportDescriptor<string>) => {
                        const node = 'node' in descriptor && 'parent' in descriptor.node ? descriptor.node : undefined;
                        if (
                            node !== undefined &&
                            [isConstantValue, isSplitLimit, isPatternSize].some((test) => test(node))
                        )
                            return;
                        context.report(descriptor as TSESLint.ReportDescriptor<'noMagic' | 'useConst'>);
                    },
                },
            }) as TSESLint.RuleContext<string, MagicNumbersOptions>,
        );
    },
});
