import { RULE_URL } from './config/plugin.ts';
import { ESLintUtils } from '@typescript-eslint/utils';
import type { RuleDocs, DocumentedRuleCreator } from './types/rules.ts';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

/** Create rule modules with their public documentation URL. */
export const createRule = ESLintUtils.RuleCreator<RuleDocs>((name) =>
    RULE_URL.replace('{name}', name),
) as DocumentedRuleCreator;

/**
 * Build an options schema that allows only the listed keys.
 *
 * @param properties the schema of each allowed option
 * @returns a JSON schema that rejects any other key
 */
export function buildOptionsSchema(properties: Record<string, JSONSchema4>): JSONSchema4 {
    return { type: 'object', properties, additionalProperties: false };
}
