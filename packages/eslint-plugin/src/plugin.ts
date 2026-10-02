import { envOwner } from '#plugin/rules/env-owner.ts';
import { EXPLICIT_RULES } from '#plugin/config/plugin.ts';
import { headerFirst } from '#plugin/rules/header-first.ts';
import { importStyle } from '#plugin/rules/import-style.ts';
import { noReexports } from '#plugin/rules/no-reexports.ts';
import { testFolders } from '#plugin/rules/test-folders.ts';
import { noClientEnv } from '#plugin/rules/no-client-env.ts';
import { exportLayout } from '#plugin/rules/export-layout.ts';
import { importLayout } from '#plugin/rules/import-layout.ts';
import { typesPlacement } from '#plugin/rules/types-placement.ts';
import { noAliasExports } from '#plugin/rules/no-alias-exports.ts';
import { noIndexImports } from '#plugin/rules/no-index-imports.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';
import packageManifest from '#plugin-package' with { type: 'json' };
import { importDirection } from '#plugin/rules/import-direction.ts';
import { noImportComments } from '#plugin/rules/no-import-comments.ts';
import { registryInstances } from '#plugin/rules/registry-instances.ts';
import { requireServerOnly } from '#plugin/rules/require-server-only.ts';
import { maxBarrelReexports } from '#plugin/rules/max-barrel-reexports.ts';
import { noDuplicateExports } from '#plugin/rules/no-duplicate-exports.ts';
import { noTrivialFunctions } from '#plugin/rules/no-trivial-functions.ts';
import { privateBeforePublic } from '#plugin/rules/private-before-public.ts';
import { noCrossScopeImports } from '#plugin/rules/no-cross-scope-imports.ts';
import { noCrossFolderImports } from '#plugin/rules/no-cross-folder-imports.ts';

const rules = {
    'env-owner': envOwner,
    'export-layout': exportLayout,
    'header-first': headerFirst,
    'import-direction': importDirection,
    'import-layout': importLayout,
    'import-style': importStyle,
    'max-barrel-reexports': maxBarrelReexports,
    'no-client-env': noClientEnv,
    'no-cross-folder-imports': noCrossFolderImports,
    'no-cross-scope-imports': noCrossScopeImports,
    'no-duplicate-exports': noDuplicateExports,
    'no-alias-exports': noAliasExports,
    'no-import-comments': noImportComments,
    'no-index-imports': noIndexImports,
    'no-reexports': noReexports,
    'no-trivial-files': noTrivialFiles,
    'no-trivial-functions': noTrivialFunctions,
    'private-before-public': privateBeforePublic,
    'registry-instances': registryInstances,
    'require-server-only': requireServerOnly,
    'test-folders': testFolders,
    'types-placement': typesPlacement,
};

const base = { meta: { name: packageManifest.name, version: packageManifest.version }, rules };

const allRules = Object.fromEntries(
    Object.keys(rules)
        .filter((name) => !EXPLICIT_RULES.has(name))
        .map((name) => [`gspot/${name}`, 'error' as const]),
);

const recommendedRules = Object.fromEntries(
    Object.entries(rules)
        .filter(([name, rule]) => rule.meta.docs?.level === 'recommended' && !EXPLICIT_RULES.has(name))
        .map(([name]) => [`gspot/${name}`, 'error' as const]),
);

const plugin = {
    ...base,
    configs: {
        /** Default rules for standalone use. */
        recommended: { name: 'gspot/recommended', plugins: { gspot: base }, rules: recommendedRules },
        /** Adds layout and ordering rules. */
        all: { name: 'gspot/all', plugins: { gspot: base }, rules: allRules },
    },
};

export default plugin;
