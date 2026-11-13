import { ESLintUtils } from '@typescript-eslint/utils';

import pluginPackage from '../package.json' with { type: 'json' };
import type { RuleDocs } from './types/plugin.ts';

export const createRule = ESLintUtils.RuleCreator<RuleDocs>((name) => `${pluginPackage.homepage}#${name}`);
