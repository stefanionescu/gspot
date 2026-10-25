import { stringify } from '@decimalturn/toml-patch';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import { SQUAWK_RECOMMENDED_OFF } from '#cli/config/generation/configurations/postgres.ts';

/**
Build squawk.toml: the disabled Squawk migration rules.

@param planned the config file with its scope, level, and target path.
@returns the disabled Squawk migration rules.
*/
export function buildSquawkFile(planned: PlannedConfigFile): string {
    const { files } = planned.session.repository;

    const isAll = planned.level === 'all';
    const migrations = files.flatMap((file) => (file.path.endsWith('.sql') && file.kind === 'source' ? file.path : []));
    const document = {
        assume_in_transaction: getTable(planned.scope.settings, 'tools.squawk').assume_in_transaction,
        excluded_rules: [
            ...listIgnoredRules(planned.scope, 'postgres/squawk'),
            ...(isAll ? [] : SQUAWK_RECOMMENDED_OFF),
        ],
        excluded_paths: [
            ...selectFrozenMigrations(migrations, getTable(planned.scope.settings, 'postgres').frozen_through),
        ],
    };
    return stringify(document, CONFIG_FILE_TOML_FORMAT);
}
