import { stringify } from '@decimalturn/toml-patch';

import { SQL_EXTENSION } from '#cli/config/configurations/infrastructure.ts';
import { SQUAWK_ALL_LEVEL_ON } from '#cli/config/configurations/postgres.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { selectFrozenMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { listDisabledRules } from '#cli/configurations/rule-options.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

function buildSquawkFile(planned: PlannedConfig): string {
    const { files } = planned.session.repository;

    const isAll = planned.level === 'all';
    const off = listDisabledRules(planned);
    const migrations = files.flatMap((file) =>
        file.path.endsWith(SQL_EXTENSION) && file.kind === 'source' ? file.path : [],
    );
    const postgres = getTable(planned.scope.settings, 'postgres');
    const document = {
        assume_in_transaction: postgres.assume_in_transaction,
        excluded_rules: off,
        ...(isAll && { included_rules: SQUAWK_ALL_LEVEL_ON.filter((rule) => !off.includes(rule)) }),
        excluded_paths: [...selectFrozenMigrations(migrations, postgres.frozen_through)],
    };
    return stringify(document, CONFIG_TOML_FORMAT);
}

export const POSTGRES_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'postgres/squawk.toml': buildSquawkFile,
};
