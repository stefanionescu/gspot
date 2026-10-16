// Foreign key columns that no index leads with, read from the schema the migrations build.
import { findingAt } from '#cli/checks/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';

/**
 * One finding for each foreign key column that no index, primary key, or unique key leads with.
 * @param input the check input.
 * @returns the findings.
 */
export async function postgresForeignKeyIndexes(input: CheckInput): Promise<Finding[]> {
    const schema = buildSchema(await readMigrations(input));
    return schema.foreignKeys
        .filter((key) => schema.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            findingAt(
                input,
                { file: key.path, ...computePosition(key.text, key.offset) },
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}
