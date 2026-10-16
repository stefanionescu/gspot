import { stringify } from '@decimalturn/toml-patch';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { TOML_FORMAT, SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/tool-files.ts';
/**
 * Build squawk file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the disabled Squawk migration rules.
 */
function buildSquawkFile(context: ToolFileContext): string {
    const { selection, files } = context;

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
