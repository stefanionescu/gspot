import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/planning.ts';
import type { EmitInputs } from '#cli/types/generation/files.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { TOOL_EMIT_FORMAT, SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the squawk configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.selection the selected scope and its settings.
 * @param root0.files the selected source files.
 * @param root0.settingsFile the captured gspot.toml and parsed settings.
 *
 * @returns the generated configuration text.
 */
export function squawkToolFile({
    selection,
    files,
    settingsFile,
}: Pick<EmitInputs, 'selection' | 'files'> & Pick<Session, 'settingsFile'>): string {
    const { settings, rulesOff } = selection.view;
    const isAll = settingsFile.settings.level === 'all';
    const migrations = files.flatMap((file) =>
        file.path.endsWith('.sql') && file.kind === 'source' ? [file.path] : [],
    );
    const document = {
        assume_in_transaction: settings['tools.squawk.assume_in_transaction'],
        excluded_rules: [...rulesOff('postgres/squawk'), ...(isAll ? [] : SQUAWK_RECOMMENDED_OFF)],
        excluded_paths: [...selectFrozenMigrations(migrations, settings['postgres.frozen_through'] as string)],
    };
    return stringify(document, TOOL_EMIT_FORMAT).trimEnd();
}
