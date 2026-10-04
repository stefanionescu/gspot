// Foreign key columns that no index leads with, read from the schema the migrations build.
import { findingAt } from '#cli/execution/finding.ts';
import { positionAt } from '#cli/parsers/sql/statements.ts';
import { schema } from '#cli/checks/database/postgres/schema.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

/**
 * One finding for each foreign key column that no index, primary key, or unique key leads with.
 * @param input the engine input
 * @returns the findings
 */
export async function foreignKeyIndexes(input: EngineInput): Promise<Finding[]> {
    const fields = schema(await migrationsOf(input));
    return fields.foreignKeys
        .filter((key) => fields.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            findingAt(
                input,
                { file: key.path, ...positionAt(key.text, key.offset) },
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}
