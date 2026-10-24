import { getPosition } from '#cli/system/text.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';

/**
Reports each foreign key whose columns do not lead an index, primary key, or unique key.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns the findings.
*/
export async function checkPostgresForeignKeyIndexes(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildSchema(migrations);
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
        .map((key) =>
            buildFinding(
                planned,
                { file: key.path, ...getPosition(key.text, key.offset) },
                'foreign-key-index',
                `${key.table} (${key.columns.join(', ')}) is a foreign key and no index leads with these columns.`,
            ),
        );
}
