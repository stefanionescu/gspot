import type { TSESLint } from '@typescript-eslint/utils';

import pluginPackage from '../package.json' with { type: 'json' };
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { TOPICS } from './registry/topics.ts';
import type { RuleDocs } from './types/plugin.ts';

const rules = Object.fromEntries(
    Object.values(TOPICS)
        .flat()
        .map((rule) => [rule.name, rule]),
);

const selectLevelRules = (levels: ReadonlyArray<RuleDocs['level']>) =>
    Object.fromEntries(
        Object.entries(rules)
            .filter(([, rule]) => rule.meta.docs !== undefined && levels.includes(rule.meta.docs.level))
            .map(([name]) => [`${PLUGIN_PREFIX}/${name}`, 'error' as const]),
    );

const configPlugins: TSESLint.FlatConfig.Plugins = {};

const plugin = {
    meta: { name: pluginPackage.name, version: pluginPackage.version },
    rules,
    configs: {
        recommended: {
            name: `${PLUGIN_PREFIX}/recommended`,
            plugins: configPlugins,
            rules: selectLevelRules(['recommended']),
        },
        all: {
            name: `${PLUGIN_PREFIX}/all`,
            plugins: configPlugins,
            rules: selectLevelRules(['recommended', 'all']),
        },
    },
};

configPlugins[PLUGIN_PREFIX] = plugin;

export default plugin;
