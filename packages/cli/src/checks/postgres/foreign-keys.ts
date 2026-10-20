import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import { MIGRATION_SYNTAX_SKIP } from '#cli/config/parsers/sql.ts';
import { readMigrations } from '#cli/checks/postgres/migrations.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Reports each foreign key column that no index, primary key, or unique key leads with.
 *
 * @param input the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkForeignKeyIndexes(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) throw new GspotError('skip', MIGRATION_SYNTAX_SKIP);
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
