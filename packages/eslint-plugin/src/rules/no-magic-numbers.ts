import { createRequire } from 'node:module';
import { createRule } from '../create-rule.ts';
import { FUNCTION_NODES } from '../config/syntax.ts';
import type { MagicNumbersOptions } from '../types/rules.ts';
import { UPSTREAM_RULE, OPTIONS_SCHEMA } from '../config/rules/no-magic-numbers.ts';
import { ESLintUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

const require = createRequire(import.meta.url);

function isModuleConstant(declaration: TSESTree.VariableDeclaration): boolean {
    if (declaration.kind !== 'const') return false;
    const holder =
        declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
            ? declaration.parent.parent
            : declaration.parent;
    return holder.type === AST_NODE_TYPES.Program;
}

function isConstantValue(node: TSESTree.Node): boolean {
    for (let ancestor: TSESTree.Node = node; ancestor.type !== AST_NODE_TYPES.Program; ancestor = ancestor.parent) {
        if (FUNCTION_NODES.has(ancestor.type)) return false;
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
                'The call `setTimeout(retry, 3000)` reports `noMagic`. Name the delay, such as `const RETRY_DELAY_MS = 3000;` at module level, and pass the constant. `const SIZES = [16, 32, 64];` and `const TIMEOUT_MS = 60 * 1000;` pass, because the constant names its numbers.',
            level: 'none',
            description:
                'Reports the numbers that @typescript-eslint/no-magic-numbers reports, except inside the initializer of a module-level `const`, including arrays and arithmetic. It takes the options of @typescript-eslint/no-magic-numbers and needs that package installed.',
            why: 'A bare number hides what it measures, and a module-level constant gives it a name that callers share.',
            fix: 'Move the number into a module-level constant whose name says what it measures.',
        },
        schema: [OPTIONS_SCHEMA],
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
                        if ('node' in descriptor && isConstantValue(descriptor.node as TSESTree.Node)) return;
                        context.report(descriptor as TSESLint.ReportDescriptor<'noMagic' | 'useConst'>);
                    },
                },
            }) as TSESLint.RuleContext<string, MagicNumbersOptions>,
        );
    },
});
