import { FOREIGN_KEY_INDEX_RULE } from '#cli/config/configurations/postgres.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema/build.ts';
import { getPosition } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkForeignKeyIndexes(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildDatabaseSchema(migrations);
    return schema.foreignKeys
        .filter(
            (key) =>
                schema.indexed
                    .get(key.table)
                    ?.some(
                        (index) =>
                            index.length >= key.columns.length &&
                            new Set(index.slice(0, key.columns.length)).isSupersetOf(new Set(key.columns)),
                    ) !== true,
        )
        .map((key) => ({
            file: key.path,
            ...getPosition(key.text, key.offset),
            rule: FOREIGN_KEY_INDEX_RULE,
            message: `${key.table} (${key.columns.join(', ')}) is a foreign key and no index leads with these columns.`,
        }));
}

export const FOREIGN_KEY_INDEXES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/foreign-key-indexes': { check: checkForeignKeyIndexes },
};
