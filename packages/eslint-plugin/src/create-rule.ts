import { RULE_DOCS_URL } from './config/plugin.ts';
import { ESLintUtils } from '@typescript-eslint/utils';
import type { RuleDocs, DocumentedRuleCreator } from './types/rules.ts';

export const createRule = ESLintUtils.RuleCreator<RuleDocs>(
    (name) => `${RULE_DOCS_URL}${name}/`,
) as DocumentedRuleCreator;
