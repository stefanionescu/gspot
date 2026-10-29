import { type RuleDocs } from './types/rules.ts';
import { ESLintUtils } from '@typescript-eslint/utils';
import pluginPackage from '../package.json' with { type: 'json' };
import { type DocumentedRuleCreator } from './types/create-rule.ts';

export const createRule = ESLintUtils.RuleCreator<RuleDocs>(
    (name) => `${pluginPackage.homepage}${name}/`,
) as DocumentedRuleCreator;
