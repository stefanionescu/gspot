import { noReexports } from '#plugin/rules/no-reexports.ts';
import { importLayout } from '#plugin/rules/import-layout.ts';
import { noCallThrough } from '#plugin/rules/no-call-through.ts';
import { typesPlacement } from '#plugin/rules/types-placement.ts';
import { noIndexImports } from '#plugin/rules/no-index-imports.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';
import packageManifest from '#plugin-package' with { type: 'json' };
import { importDirection } from '#plugin/rules/import-direction.ts';
import { importPathStyle } from '#plugin/rules/import-path-style.ts';
import { requireServerOnly } from '#plugin/rules/require-server-only.ts';
import { noExportOnlyFiles } from '#plugin/rules/no-export-only-files.ts';
import { maxBarrelReexports } from '#plugin/rules/max-barrel-reexports.ts';
import { noClientEnvironment } from '#plugin/rules/no-client-environment.ts';
import { privateBeforePublic } from '#plugin/rules/private-before-public.ts';
import { registryInstanceOnly } from '#plugin/rules/registry-instance-only.ts';
import { noCrossFolderImports } from '#plugin/rules/no-cross-folder-imports.ts';
import { noCrossProjectImports } from '#plugin/rules/no-cross-project-imports.ts';
import { testsDirectoryContents } from '#plugin/rules/tests-directory-contents.ts';
import { noHarnessBarrelImports } from '#plugin/rules/no-harness-barrel-imports.ts';
import { noReexportsOutsideIndex } from '#plugin/rules/no-reexports-outside-index.ts';
import { noDuplicateBarrelExports } from '#plugin/rules/no-duplicate-barrel-exports.ts';
import { noExportedAliasConstants } from '#plugin/rules/no-exported-alias-constants.ts';
// The plugin object: rules and configs. The package entry; the flat config registers it under the key `gspot`.
import { envAccessOwner as environmentAccessOwner } from '#plugin/rules/env-access-owner.ts';
import { headerCommentsBeforeImports } from '#plugin/rules/header-comments-before-imports.ts';

const rules = {
    'env-access-owner': environmentAccessOwner,
    'header-comments-before-imports': headerCommentsBeforeImports,
    'import-direction': importDirection,
    'import-layout': importLayout,
    'import-path-style': importPathStyle,
    'max-barrel-reexports': maxBarrelReexports,
    'no-call-through': noCallThrough,
    'no-client-environment': noClientEnvironment,
    'no-cross-folder-imports': noCrossFolderImports,
    'no-cross-project-imports': noCrossProjectImports,
    'no-duplicate-barrel-exports': noDuplicateBarrelExports,
    'no-export-only-files': noExportOnlyFiles,
    'no-exported-alias-constants': noExportedAliasConstants,
    'no-index-imports': noIndexImports,
    'no-reexports': noReexports,
    'no-reexports-outside-index': noReexportsOutsideIndex,
    'tests-directory-contents': testsDirectoryContents,
    'no-harness-barrel-imports': noHarnessBarrelImports,
    'no-trivial-files': noTrivialFiles,
    'private-before-public': privateBeforePublic,
    'registry-instance-only': registryInstanceOnly,
    'require-server-only': requireServerOnly,
    'types-placement': typesPlacement,
};

// The rules for a project that allows re-exports in index files only; the recommended set bans re-exports outright.
const INDEX_ONLY_RULES = new Set(['no-reexports-outside-index', 'no-duplicate-barrel-exports', 'max-barrel-reexports']);

const base = { meta: { name: packageManifest.name, version: packageManifest.version }, rules };

const allRules = Object.fromEntries(
    Object.keys(rules)
        .filter((name) => !INDEX_ONLY_RULES.has(name))
        .map((name) => [`gspot/${name}`, 'error' as const]),
);

const recommendedRules = Object.fromEntries(
    Object.entries(allRules).filter(([name]) => name !== 'gspot/no-call-through'),
);

const plugin = {
    ...base,
    configs: {
        /** Default rules for standalone use. */
        recommended: { name: 'gspot/recommended', plugins: { gspot: base }, rules: recommendedRules },
        /** Adds preferences such as rejecting forwarding functions. */
        all: { name: 'gspot/all', plugins: { gspot: base }, rules: allRules },
    },
};

export default plugin;
