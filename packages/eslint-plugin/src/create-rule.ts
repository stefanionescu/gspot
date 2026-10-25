import { ESLintUtils } from '@typescript-eslint/utils';
import pluginPackage from '../package.json' with { type: 'json' };
import type { RuleDocs, DocumentedRuleCreator } from './types/rules.ts';

export const createRule = ESLintUtils.RuleCreator<RuleDocs>(
    (name) => `${pluginPackage.homepage}${name}/`,
) as DocumentedRuleCreator;
