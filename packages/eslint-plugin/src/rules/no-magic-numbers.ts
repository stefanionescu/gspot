// The magic number rule of typescript-eslint, except for the numbers that a module-level constant already names.
import { createRequire } from 'node:module';
import { createRule } from '../create-rule.ts';
import type { MagicNumbersOptions } from '../types/rules.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { UPSTREAM_RULE, FUNCTION_NODES, UPSTREAM_PACKAGE } from '../config/magic-numbers.ts';

const requireModule = createRequire(import.meta.url);

// The rule loads only where gspot turns it on, in TypeScript scopes, which install typescript-eslint.
function findUpstreamRule(): TSESLint.RuleModule<string, unknown[]> {
    const upstream = requireModule(UPSTREAM_PACKAGE) as {
        rules: Record<string, TSESLint.RuleModule<string, unknown[]>>;
    };
    const rule = upstream.rules[UPSTREAM_RULE];
    if (rule === undefined) throw new Error(`${UPSTREAM_PACKAGE} has no ${UPSTREAM_RULE} rule.`);
    return rule;
}

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
        if (FUNCTION_NODES.has(current.type)) return false;
        if (current.type === AST_NODE_TYPES.VariableDeclarator) return isModuleConstant(current.parent);
    }
    return false;
}

export const noMagicNumbers = createRule<MagicNumbersOptions, 'noMagic'>({
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
        schema: [{ type: 'object', additionalProperties: true }],
        messages: { noMagic: 'No magic number: {{raw}}. Name it in a module-level constant.' },
    },
    create(context) {
        return findUpstreamRule().create(
            Object.create(context, {
                report: {
                    value: (descriptor: TSESLint.ReportDescriptor<string>) => {
                        if ('node' in descriptor && isConstantValue(descriptor.node as TSESTree.Node)) return;
                        context.report(descriptor as TSESLint.ReportDescriptor<'noMagic'>);
                    },
                },
            }) as TSESLint.RuleContext<string, unknown[]>,
        );
    },
});
