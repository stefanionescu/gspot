import { listNodeFields } from '#cli/parsers/code/sql.ts';
import type { SqlStatement } from '#cli/types/parsers.ts';
import { getPosition } from '#cli/system/text/positions.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { EDITED_MIGRATION_EXPLANATIONS } from '#cli/configurations/database/postgres/explanations.ts';

import {
    FROZEN_RULE,
    DRIFT_GUARD_RULE,
    DRIFT_GUARD_MESSAGE,
    FROZEN_EDIT_MESSAGE,
} from '#cli/config/configurations/postgres.ts';
import {
    extractForwardText,
    readParsedMigrations,
    listUnfrozenMigrations,
    readCommittedMigrations,
} from '#cli/configurations/database/postgres/checks/migrations.ts';

function hasDriftGuard(statement: SqlStatement): boolean {
    if (statement.kind === 'IndexStmt')
        return statement.fields.if_not_exists === true && statement.fields.concurrent !== true;
    if (statement.kind === 'AlterTableStmt')
        return listNodeFields(statement.fields.cmds, 'AlterTableCmd').some(
            (command) => command.subtype === 'AT_AddColumn' && command.missing_ok === true,
        );
    return 'if_not_exists' in statement.fields && statement.fields.if_not_exists;
}

async function checkEditedMigrations(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const guards = listUnfrozenMigrations(migrations, planned).flatMap((migration) =>
        migration.statements
            .filter((statement) => hasDriftGuard(statement))
            .map((statement) => ({
                file: migration.path,
                ...getPosition(migration.text, statement.start),
                rule: DRIFT_GUARD_RULE,
                message: DRIFT_GUARD_MESSAGE,
                help: EDITED_MIGRATION_EXPLANATIONS[DRIFT_GUARD_RULE].fix,
            })),
    );
    const texts = await readCommittedMigrations(session, migrations);
    const edited = migrations.flatMap((migration): CheckFinding[] => {
        const committed = texts.get(migration.path);
        if (committed === undefined || extractForwardText(committed) === migration.text) return [];
        return [
            {
                file: migration.path,
                line: 1,
                rule: FROZEN_RULE,
                message: FROZEN_EDIT_MESSAGE,
                help: EDITED_MIGRATION_EXPLANATIONS[FROZEN_RULE].fix,
            },
        ];
    });
    return [...edited, ...guards];
}

export const POSTGRES_EDITED_MIGRATIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/edited-migrations': { check: checkEditedMigrations, explanations: EDITED_MIGRATION_EXPLANATIONS },
};
