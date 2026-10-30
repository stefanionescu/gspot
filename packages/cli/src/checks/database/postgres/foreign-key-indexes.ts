import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { buildDatabaseSchema } from '#cli/checks/database/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { FOREIGN_KEY_INDEX_RULE } from '#cli/config/checks/database/postgres/foreign-key-indexes.ts';

/**
Reports each foreign key whose columns do not lead an index, primary key, or unique key.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
export async function checkForeignKeyIndexes(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
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
