import { getTable } from '#cli/settings/scopes.ts';
import { stringify } from '@decimalturn/toml-patch';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { listOffRules } from '#cli/configurations/rule-options.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';
import { SQL_EXTENSION, SQUAWK_ALL_LEVEL_ON } from '#cli/config/configurations/infrastructure.ts';

/**
Build squawk.toml: the disabled Squawk migration rules.

@param planned the config file to build.
*/
export function buildSquawkFile(planned: PlannedConfig): string {
    const { files } = planned.session.repository;

    const isAll = planned.level === 'all';
    const off = listOffRules(planned);
    const migrations = files.flatMap((file) =>
        file.path.endsWith(SQL_EXTENSION) && file.kind === 'source' ? file.path : [],
    );
    const document = {
        assume_in_transaction: getTable(planned.scope.settings, 'postgres').assume_in_transaction,
        excluded_rules: off,
        ...(isAll && { included_rules: SQUAWK_ALL_LEVEL_ON.filter((rule) => !off.includes(rule)) }),
        excluded_paths: [
            ...selectFrozenMigrations(migrations, getTable(planned.scope.settings, 'postgres').frozen_through),
        ],
    };
    return stringify(document, CONFIG_TOML_FORMAT);
}
