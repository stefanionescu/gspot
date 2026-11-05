import type { GrantStmt } from '@pgsql/types';

import { GRANT_ALL_MESSAGE, GRANT_ALL_RULE } from '#cli/config/configurations/infrastructure.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Reports each grant of every privilege in a migration after the frozen ones.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
async function checkGrants(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        getTable(planned.scope.settings, 'postgres').frozen_through,
    );
    return migrations
        .filter(({ path }) => !frozen.has(path))
        .flatMap((migration) => migration.statements.map((statement) => ({ migration, statement })))
        .filter(({ statement }) => {
            let grant: GrantStmt | undefined;
            if (statement.kind === 'GrantStmt') grant = statement.fields;
            else if (statement.kind === 'AlterDefaultPrivilegesStmt') grant = statement.fields.action;
            return grant?.is_grant === true && grant.privileges === undefined;
        })
        .map(({ migration, statement }) => ({
            file: migration.path,
            ...getPosition(migration.text, statement.start),
            rule: GRANT_ALL_RULE,
            message: GRANT_ALL_MESSAGE,
        }));
}

export const POSTGRES_GRANTS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/grants': { check: checkGrants },
};
