import { stringify } from '@decimalturn/toml-patch';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { TOML_FORMAT, SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/settings.ts';

/**
 * Build the Squawk file from the settings.
 *
 * @param context the tool file to build.
 * @returns the disabled Squawk migration rules.
 */
function buildSquawkFile(context: ToolFileContext): string {
    const { files } = context.session.repository;

    const isAll = context.level === 'all';
    const migrations = files.flatMap((file) =>
        file.path.endsWith('.sql') && file.kind === 'source' ? [file.path] : [],
    );
    const document = {
        assume_in_transaction: getTable(context.selection.view, 'tools.squawk').assume_in_transaction,
        excluded_rules: [
            ...listIgnoredRules(context.selection, 'postgres/squawk'),
            ...(isAll ? [] : SQUAWK_RECOMMENDED_OFF),
        ],
        excluded_paths: [
            ...selectFrozenMigrations(migrations, getTable(context.selection.view, 'postgres').frozen_through),
        ],
    };
    return stringify(document, TOML_FORMAT);
}

export { buildSquawkFile };
