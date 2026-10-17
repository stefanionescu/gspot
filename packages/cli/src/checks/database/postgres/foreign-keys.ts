import { buildFinding } from '#cli/checks/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { buildSchema } from '#cli/checks/database/postgres/schema.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';

/**
 * Reports each foreign key column that no index, primary key, or unique key leads with.
 * @param input the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkForeignKeyIndexes(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    const schema = buildSchema(migrations);
    return schema.foreignKeys
        .filter((key) => schema.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            buildFinding(
                input,
                { file: key.path, ...computePosition(key.text, key.offset) },
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}
