import { type RuleDocs } from './types/rules.ts';
import { ESLintUtils } from '@typescript-eslint/utils';
import pluginPackage from '../package.json' with { type: 'json' };

export const createRule = ESLintUtils.RuleCreator<RuleDocs>((name) => `${pluginPackage.homepage}${name}/`);
