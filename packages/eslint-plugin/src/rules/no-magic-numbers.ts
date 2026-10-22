import { createRequire } from 'node:module';
import { FUNCTION_TYPES } from '../config/syntax.ts';
import { createRule } from '../schemas/rules/options.ts';
import type { MagicNumbersOptions } from '../types/rules.ts';
import { magicNumbersOptionsSchema } from '../schemas/rules/no/magic-numbers.ts';
import { UPSTREAM_RULE, UPSTREAM_PACKAGE } from '../config/rules/no-magic-numbers.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

const requireModule = createRequire(import.meta.url);

function isModuleConstant(declaration: TSESTree.VariableDeclaration): boolean {
    if (declaration.kind !== 'const') return false;
    const holder =
        declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
            ? declaration.parent.parent
            : declaration.parent;
    return holder.type === AST_NODE_TYPES.Program;
}

// A number in the initializer of a module-level const, such as an array of sizes or a product of time units, already
// has a name. A number inside a function of that initializer still counts.
function isConstantValue(node: TSESTree.Node): boolean {
    for (let current: TSESTree.Node = node; current.type !== AST_NODE_TYPES.Program; current = current.parent) {
        if (FUNCTION_TYPES.has(current.type)) return false;
        if (current.type === AST_NODE_TYPES.VariableDeclarator) return isModuleConstant(current.parent);
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
        schema: [magicNumbersOptionsSchema],
        messages: {
            noMagic: 'No magic number: {{raw}}. Name it in a module-level constant.',
            useConst: 'Declare this number with const at module level, and name it.',
        },
    },
    create(context) {
        // @typescript-eslint/eslint-plugin stays an optional peer, so the rule requires it only when ESLint runs this
        // rule.
        const upstream = requireModule(UPSTREAM_PACKAGE) as {
            rules: Record<typeof UPSTREAM_RULE, TSESLint.RuleModule<string, unknown[]>>;
        };
        return upstream.rules[UPSTREAM_RULE].create(
            Object.create(context, {
                report: {
                    value: (descriptor: TSESLint.ReportDescriptor<string>) => {
                        if ('node' in descriptor && isConstantValue(descriptor.node as TSESTree.Node)) return;
                        context.report(descriptor as TSESLint.ReportDescriptor<'noMagic' | 'useConst'>);
                    },
                },
            }) as TSESLint.RuleContext<string, unknown[]>,
        );
    },
});
