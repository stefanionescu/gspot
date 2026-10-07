// Foreign key columns that no index leads with, read from the schema the migrations build.
import { findingAt } from '#cli/execution/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { positionAt } from '#cli/parsers/sql/statements.ts';
import type { EngineInput } from '#cli/types/execution/runtime.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';

/**
 * One finding for each foreign key column that no index, primary key, or unique key leads with.
 * @param input the engine input
 * @returns the findings
 */
export async function foreignKeyIndexes(input: EngineInput): Promise<Finding[]> {
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
