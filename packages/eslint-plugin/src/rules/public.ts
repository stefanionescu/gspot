import type { Plugin } from '#plugin/types/plugin.ts';
import { envOwner } from '#plugin/rules/env-owner.ts';
import { headerFirst } from '#plugin/rules/header-first.ts';
import { sortExports } from '#plugin/rules/sort-exports.ts';
import { sortImports } from '#plugin/rules/sort-imports.ts';
import { noClientEnv } from '#plugin/rules/no-client-env.ts';
import { noAliasExports } from '#plugin/rules/no-alias-exports.ts';
import { noIndexImports } from '#plugin/rules/no-index-imports.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';
import packageManifest from '#plugin-package' with { type: 'json' };
import { importBoundaries } from '#plugin/rules/import-boundaries.ts';
import { requireServerOnly } from '#plugin/rules/require-server-only.ts';
import { noTrivialFunctions } from '#plugin/rules/no-trivial-functions.ts';

const rules = {
    'env-owner': envOwner,
    'sort-exports': sortExports,
    'header-first': headerFirst,
    'sort-imports': sortImports,
    'no-client-env': noClientEnv,
    'import-boundaries': importBoundaries,
    'no-alias-exports': noAliasExports,
    'no-index-imports': noIndexImports,
    'no-trivial-files': noTrivialFiles,
    'no-trivial-functions': noTrivialFunctions,
    'require-server-only': requireServerOnly,
};

const allRules = Object.fromEntries(
    Object.entries(rules)
        .filter(([, rule]) => rule.meta.docs?.level !== 'none')
        .map(([name]) => [`gspot/${name}`, 'error' as const]),
);

const recommendedRules = Object.fromEntries(
    Object.entries(rules)
        .filter(([, rule]) => rule.meta.docs?.level === 'recommended')
        .map(([name]) => [`gspot/${name}`, 'error' as const]),
);

const plugin = {
    meta: { name: packageManifest.name, version: packageManifest.version },
    rules,
} satisfies Plugin;

// All adds naming, import order, layout, and complexity conventions.
export default Object.assign(plugin, {
    configs: {
        recommended: { name: 'gspot/recommended', plugins: { gspot: plugin }, rules: recommendedRules },
        all: { name: 'gspot/all', plugins: { gspot: plugin }, rules: allRules },
    },
});
