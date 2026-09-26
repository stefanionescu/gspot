import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESLint } from '@typescript-eslint/utils';
import type { RuleDocs, RuleSpec } from '#plugin/types/plugin.ts';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

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

/**
 * An object with the given properties and nothing else.
 * @param properties the property schemas
 * @param required the property names that must be present
 * @returns the schema
 */
export function optionsSchema(properties: Record<string, JSONSchema4>, required: string[] = []): JSONSchema4 {
    return { type: 'object', properties, additionalProperties: false, ...(required.length > 0 ? { required } : {}) };
}
