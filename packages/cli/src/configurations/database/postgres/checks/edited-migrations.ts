import {
    DRIFT_GUARD_MESSAGE,
    DRIFT_GUARD_RULE,
    FROZEN_EDIT_MESSAGE,
    FROZEN_RULE,
} from '#cli/config/configurations/infrastructure.ts';
import {
    extractForwardText,
    readCommittedMigrations,
    readParsedMigrations,
} from '#cli/configurations/database/postgres/checks/migrations.ts';
import { EDITED_MIGRATION_EXPLANATIONS } from '#cli/configurations/database/postgres/explanations.ts';
import { listNodeFields, selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckSession } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { SqlStatement } from '#cli/types/parsers.ts';

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
Reports each migration of the base revision whose text differs from the committed text, and each `IF NOT EXISTS` after
the frozen migrations, except on `CREATE INDEX CONCURRENTLY`.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
*/
async function checkEditedMigrations(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const frozen = selectFrozenMigrations(
        migrations.map((migration) => migration.path),
        getTable(planned.scope.settings, 'postgres')['frozen_through'],
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
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        session.selection?.base ?? 'HEAD',
    );
    const edited = migrations.flatMap((migration): CheckFinding[] => {
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

export const POSTGRES_EDITED_MIGRATIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/edited-migrations': { check: checkEditedMigrations, explanations: EDITED_MIGRATION_EXPLANATIONS },
};
