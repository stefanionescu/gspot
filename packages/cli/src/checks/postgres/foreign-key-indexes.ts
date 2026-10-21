import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { computePosition } from '#cli/system/text.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import { readParsedMigrations } from '#cli/checks/postgres/migrations.ts';

/**
 * Reports each foreign key column that no index, primary key, or unique key leads with.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkForeignKeyIndexes(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildSchema(migrations);
    return schema.foreignKeys
        .filter((key) => schema.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            buildFinding(
                planned,
                { file: key.path, ...computePosition(key.text, key.offset) },
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}
