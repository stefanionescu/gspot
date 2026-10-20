import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { buildSchema } from '#cli/checks/postgres/schema.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';
import type { SqlStatementView } from '#cli/types/parsers/sql.ts';
import { MIGRATION_SYNTAX_SKIP } from '#cli/config/parsers/sql.ts';
import { readMigrations } from '#cli/checks/postgres/migrations.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import { getNodeFields, listNodeFields } from '#cli/parsers/sql/postgres.ts';

function isLooseDefiner(statement: SqlStatementView): boolean {
    if (statement.kind !== 'CreateFunctionStmt') return false;
    const options = listNodeFields(statement.fields.options, 'DefElem');
    const isDefiner = options.some(
        (option) => option.defname === 'security' && getNodeFields(option.arg, 'Boolean')?.boolval === true,
    );
    const hasPath = options.some(
        (option) => option.defname === 'set' && getNodeFields(option.arg, 'VariableSetStmt')?.name === 'search_path',
    );
    return isDefiner && !hasPath;
}

function checkStatements(
    input: CheckInput,
    migrations: Migration[],
    { rule, message, isWrong }: { rule: string; message: string; isWrong: (statement: SqlStatementView) => boolean },
): Finding[] {
    return migrations.flatMap((migration) =>
        migration.statements
            .filter((statement) => isWrong(statement))
            .map((statement) =>
                buildFinding(
                    input,
                    { file: migration.path, ...computePosition(migration.text, statement.start) },
                    rule,
                    message,
                ),
            ),
    );
}

/**
 * Reports each table in a client schema with row security off.
 *
 * @param input the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkRowLevelSecurity(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) throw new GspotError('skip', MIGRATION_SYNTAX_SKIP);
    const schema = buildSchema(migrations);
    const schemas = new Set(input.selection.view.options('postgres')['client_schemas']);
    return schema.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
        .map(([table, at]) =>
            buildFinding(
                input,
                { file: at.path, ...computePosition(at.text, at.offset) },
                'row-security',
                `${table} does not have row level security enabled.`,
            ),
        )
        .toArray();
}

/**
 * Reports each grant of every privilege in a migration after the frozen ones.
 *
 * @param input the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkPostgresGrants(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) throw new GspotError('skip', MIGRATION_SYNTAX_SKIP);
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        input.selection.view.options('postgres').frozen_through,
    );
    return checkStatements(
        input,
        migrations.filter(({ path }) => !frozen.has(path)),
        {
            rule: 'grant-all',
            message: 'GRANT ALL gives every privilege, present and future; name the privileges.',
            isWrong: (statement: SqlStatementView): boolean => {
                return (
                    statement.kind === 'GrantStmt' &&
                    statement.fields.is_grant === true &&
                    statement.fields.privileges === undefined
                );
            },
        },
    );
}

/**
 * Reports each SECURITY DEFINER function that sets no search_path.
 *
 * @param input the scope whose migrations to read.
 * @returns the findings.
 */
export async function checkDefinerSearchPath(input: CheckInput): Promise<Finding[]> {
    const message =
        'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) throw new GspotError('skip', MIGRATION_SYNTAX_SKIP);
    return checkStatements(input, migrations, {
        rule: 'definer-search-path',
        message: message,
        isWrong: isLooseDefiner,
    });
}
