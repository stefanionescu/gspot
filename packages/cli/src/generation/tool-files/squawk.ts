import { stringify } from '@decimalturn/toml-patch';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { TOML_FORMAT, SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/tool-files.ts';

/**
 * Build the Squawk file from the settings.
 *
 * @param context the tool file to build.
 * @returns the disabled Squawk migration rules.
 */
function buildSquawkFile(context: ToolFileContext): string {
    const { selection } = context;
    const { files } = context.session.repository;

    const { settings, rulesOff } = selection.view;
    const isAll = context.level === 'all';
    const migrations = files.flatMap((file) =>
        file.path.endsWith('.sql') && file.kind === 'source' ? [file.path] : [],
    );
    const document = {
        assume_in_transaction: settings['tools.squawk.assume_in_transaction'],
        excluded_rules: [...rulesOff('postgres/squawk'), ...(isAll ? [] : SQUAWK_RECOMMENDED_OFF)],
        excluded_paths: [...selectFrozenMigrations(migrations, settings['postgres.frozen_through'] as string)],
    };
    return stringify(document, TOML_FORMAT).trimEnd();
}

export { buildSquawkFile };
