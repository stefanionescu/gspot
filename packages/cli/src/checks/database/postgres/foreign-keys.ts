// Foreign key columns that no index leads with, read from the schema the migrations build.
import { findingAt } from '#cli/checks/finding.ts';
import { positionAt } from '#cli/parsers/sql/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { migrationsOf } from '#cli/checks/database/postgres/public.ts';
import { buildSchema } from '#cli/checks/database/postgres/contracts.ts';

/**
 * One finding for each foreign key column that no index, primary key, or unique key leads with.
 * @param input the check input
 * @returns the findings
 */
export async function foreignKeyIndexes(input: CheckInput): Promise<Finding[]> {
    const schema = buildSchema(await migrationsOf(input));
    return schema.foreignKeys
        .filter((key) => schema.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            findingAt(
                input,
                { file: key.path, ...positionAt(key.text, key.offset) },
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}
