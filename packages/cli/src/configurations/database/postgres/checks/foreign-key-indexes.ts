import { getPosition } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import type { CheckFinding } from '#cli/types/engine/check.ts';
import type { PlannedCheck } from '#cli/types/engine/planning.ts';
import { FOREIGN_KEY_INDEX_RULE } from '#cli/config/configurations/infrastructure.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';

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
