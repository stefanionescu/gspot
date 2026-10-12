import { PLUGIN_PREFIX } from './config/plugin.ts';
import { headerFirst } from './rules/header-first.ts';
import { noClientEnv } from './rules/no-client-env.ts';
import { noAliasExports } from './rules/no-alias-exports.ts';
import { noIndexImports } from './rules/no-index-imports.ts';
import { noTrivialFiles } from './rules/no-trivial-files.ts';
import { importBoundaries } from './rules/import-boundaries.ts';
import { requireServerOnly } from './rules/require-server-only.ts';
import { noTrivialFunctions } from './rules/no-trivial-functions.ts';
import { name, version } from '../package.json' with { type: 'json' };

const rules = {
    'header-first': headerFirst,
    'no-client-env': noClientEnv,
    'import-boundaries': importBoundaries,
    'no-alias-exports': noAliasExports,
    'no-index-imports': noIndexImports,
    'no-trivial-files': noTrivialFiles,
    'no-trivial-functions': noTrivialFunctions,
    'require-server-only': requireServerOnly,
};

const rulesAt = (levels: string[]) =>
    Object.fromEntries(
        Object.entries(rules)
            .filter(([, rule]) => levels.includes(rule.meta.docs.level))
            .map(([name]) => [`${PLUGIN_PREFIX}/${name}`, 'error' as const]),
    );

const plugin = {
    meta: { name, version },
    rules,
};

// all adds the house-style rules: comment placement, import paths, aliases, and trivial code.
export default Object.assign(plugin, {
    configs: {
        recommended: {
            name: `${PLUGIN_PREFIX}/recommended`,
            plugins: { gspot: plugin },
            rules: rulesAt(['recommended']),
        },
        all: { name: `${PLUGIN_PREFIX}/all`, plugins: { gspot: plugin }, rules: rulesAt(['recommended', 'all']) },
    },
});
