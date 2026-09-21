// The rule creator every rule uses: docs carry summary, why and fix, in plain words, like a check manifest.
import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';
import type { RuleSpec, RuleDocs } from '#plugin-types/plugin.ts';

const base = ESLintUtils.RuleCreator<RuleDocs>((name) => `https://gspot.dev/reference/plugin/${name}/`);

/**
 * Creates a rule whose docs description is its summary.
 * @param spec the rule's name, meta, defaults and create function
 * @returns the ESLint rule module
 */
export function createRule<Options extends readonly unknown[], MessageIds extends string>(
    spec: RuleSpec<Options, MessageIds>,
): TSESLint.RuleModule<MessageIds, Options, RuleDocs> {
    return base<Options, MessageIds>({
        name: spec.name,
        meta: {
            ...spec.meta,
            defaultOptions: spec.defaultOptions,
            docs: { level: 'all', description: spec.meta.docs.summary, ...spec.meta.docs },
        },
        defaultOptions: spec.defaultOptions,
        create: spec.create,
    });
}
