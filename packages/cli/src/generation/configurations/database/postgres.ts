import { stringify } from '@decimalturn/toml-patch';
import { SQL_EXTENSION } from '#cli/config/files/names.ts';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import { SQUAWK_CHECK } from '#cli/config/checks/database/postgres.ts';
import { SQUAWK_TABLE, SQUAWK_DEFAULT_LEVEL_OFF } from '#cli/config/generation/configurations/database.ts';

/**
Build squawk.toml: the disabled Squawk migration rules.

@param planned the config file to build.
*/
export function buildSquawkFile(planned: PlannedConfig): string {
    const { files } = planned.session.repository;

    const isAll = planned.level === 'all';
    const migrations = files.flatMap((file) =>
        file.path.endsWith(SQL_EXTENSION) && file.kind === 'source' ? file.path : [],
    );
    const document = {
        assume_in_transaction: getTable(planned.scope.settings, SQUAWK_TABLE).assume_in_transaction,
        excluded_rules: [...listIgnoredRules(planned.scope, SQUAWK_CHECK), ...(isAll ? [] : SQUAWK_DEFAULT_LEVEL_OFF)],
        excluded_paths: [
            ...selectFrozenMigrations(migrations, getTable(planned.scope.settings, 'postgres').frozen_through),
        ],
    };
    return stringify(document, CONFIG_TOML_FORMAT);
}
