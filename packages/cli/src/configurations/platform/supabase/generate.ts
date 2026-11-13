import { FILE_EXTENSION_RULE, IMPORT_EXTENSIONS } from '#cli/config/configurations/javascript/blocks.ts';
import { SUPABASE_RULES } from '#cli/config/configurations/supabase.ts';
import { getTable } from '#cli/settings/tables.ts';
import { escapeGlob } from '#cli/system/patterns.ts';
import type { ConfigurationBlocks, EslintBlockBuilder, EslintScope } from '#cli/types/configurations/javascript.ts';

function buildSupabaseBlocks(scope: EslintScope): ConfigurationBlocks {
    const folder = escapeGlob(getTable(scope.settings, 'supabase').functions_folder);
    const files = scope.eslintFiles.code.map((pattern) => [`${folder}/**`, pattern]);
    const settings = { n: { tryExtensions: IMPORT_EXTENSIONS, typescriptExtensionMap: [] } };
    return [{ fields: { files, settings, rules: { ...SUPABASE_RULES, [FILE_EXTENSION_RULE]: ['error', 'always'] } } }];
}

export const SUPABASE_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    supabase: buildSupabaseBlocks,
};
