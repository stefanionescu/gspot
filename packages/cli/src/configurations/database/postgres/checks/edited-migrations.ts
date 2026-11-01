import { CheckStop } from '#cli/system/errors.ts';
import { getPosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/tools.ts';
import { FROZEN_NONE } from '#cli/config/parsers.ts';
import type { SqlStatement } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { listNodeFields, selectFrozenMigrations } from '#cli/parsers/code/sql.ts';

import {
    extractForwardText,
    readParsedMigrations,
    readCommittedMigrations,
} from '#cli/configurations/database/postgres/checks/migrations.ts';
import {
    FROZEN_RULE,
    DRIFT_GUARD_RULE,
    FROZEN_THROUGH_NOTE,
    FROZEN_EDIT_MESSAGE,
    DRIFT_GUARD_MESSAGE,
} from '#cli/config/configurations/infrastructure.ts';

function hasDriftGuard(statement: SqlStatement): boolean {
    if (statement.kind === 'IndexStmt')
        return statement.fields.if_not_exists === true && statement.fields.concurrent !== true;
    if (statement.kind === 'AlterTableStmt')
        return listNodeFields(statement.fields.cmds, 'AlterTableCmd').some(
            (command) => command.subtype === 'AT_AddColumn' && command.missing_ok === true,
        );
    return 'if_not_exists' in statement.fields && statement.fields.if_not_exists;
}

/**
Reports each migration at or before postgres.frozen_through whose text differs from the committed text, and each
`IF NOT EXISTS` after the frozen migrations, except on `CREATE INDEX CONCURRENTLY`.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
*/
export async function checkEditedMigrations(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const through = getTable(planned.scope.settings, 'postgres')['frozen_through'];
    const migrations = await readParsedMigrations(session, planned);
    const frozen = selectFrozenMigrations(
        migrations.map((migration) => migration.path),
        through,
    );
    const guards = migrations
        .filter((migration) => !frozen.has(migration.path))
        .flatMap((migration) =>
            migration.statements
                .filter((statement) => hasDriftGuard(statement))
                .map((statement) => ({
                    file: migration.path,
                    ...getPosition(migration.text, statement.start),
                    rule: DRIFT_GUARD_RULE,
                    message: DRIFT_GUARD_MESSAGE,
                })),
        );
    if (through === FROZEN_NONE) {
        if (guards.length === 0) throw new CheckStop('skipped', FROZEN_THROUGH_NOTE);
        return guards;
    }
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        planned.base ?? 'HEAD',
    );
    const edited = migrations
        .filter((migration) => frozen.has(migration.path))
        .flatMap((migration): CheckFinding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || extractForwardText(committed) === migration.text) return [];
            return [
                {
                    file: migration.path,
                    line: 1,
                    rule: FROZEN_RULE,
                    message: FROZEN_EDIT_MESSAGE,
                },
            ];
        });
    return [...edited, ...guards];
}
