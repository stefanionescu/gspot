import { stringify } from '@decimalturn/toml-patch';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { TOOL_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';
import { SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/settings/builders/squawk.ts';

/**
 * Build the Squawk file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the disabled Squawk migration rules.
 */
export function buildSquawkFile(planned: PlannedToolFile): string {
    const { files } = planned.session.repository;

    const isAll = planned.level === 'all';
    const migrations = files.flatMap((file) =>
        file.path.endsWith('.sql') && file.kind === 'source' ? [file.path] : [],
    );
    const document = {
        assume_in_transaction: getTable(planned.selection.view, 'tools.squawk').assume_in_transaction,
        excluded_rules: [
            ...listIgnoredRules(planned.selection, 'postgres/squawk'),
            ...(isAll ? [] : SQUAWK_RECOMMENDED_OFF),
        ],
        excluded_paths: [
            ...selectFrozenMigrations(migrations, getTable(planned.selection.view, 'postgres').frozen_through),
        ],
    };
    return stringify(document, TOOL_FILE_TOML_FORMAT);
}
