import { nodesOf } from '#cli/parsers/sql/tree.ts';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { positionAt } from '#cli/parsers/sql/statements.ts';
import type { Declared } from '#cli/checks/postgres/types.ts';
// The checks that read the schema the migrations build: row security, grants, definer functions and foreign key indexes.
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import type { SqlNode, SqlStatementView } from '#cli/parsers/sql/types.ts';
import { schemaFacts, DEFAULT_SCHEMA  } from '#cli/checks/postgres/schema/facts.ts';

function finding(input: EngineInput, at: Declared, rule: string, text: string): Finding {
    return {
        check: input.spec.name,
        file: at.path,
        ...positionAt(at.text, at.offset),
        rule,
        message: text,
        fixable: false,
    };
}

function isGrantAll(statement: SqlStatementView): boolean {
    return (
        statement.kind === 'GrantStmt' &&
        statement.fields['is_grant'] === true &&
        statement.fields['privileges'] === undefined
    );
}

function isLooseDefiner(statement: SqlStatementView): boolean {
    if (statement.kind !== 'CreateFunctionStmt') return false;
    const options = nodesOf(statement.fields['options'], 'DefElem');
    const isDefiner = options.some(
        (option) =>
            option['defname'] === 'security' &&
            ((option['arg'] as SqlNode | undefined)?.['Boolean'] as SqlNode | undefined)?.['boolval'] === true,
    );
    const hasPath = options.some(
        (option) =>
            option['defname'] === 'set' &&
            ((option['arg'] as SqlNode | undefined)?.['VariableSetStmt'] as SqlNode | undefined)?.['name'] ===
                'search_path',
    );
    return isDefiner && !hasPath;
}

async function statementFindings(
    input: EngineInput,
    rule: string,
    text: string,
    isWrong: (statement: SqlStatementView) => boolean,
): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    return migrations.flatMap((migration) =>
        migration.statements
            .filter((statement) => isWrong(statement))
            .map((statement) =>
                finding(input, { path: migration.path, offset: statement.start, text: migration.text }, rule, text),
            ),
    );
}

/**
 * One finding for each table in a client schema with no row security, or with row security and no policy.
 * @param input the engine input
 * @returns the findings
 */
export async function rlsPresent(input: EngineInput): Promise<Finding[]> {
    const facts = schemaFacts(await migrationsOf(input));
    const schemas = new Set(
        (input.view.tool('postgres')['client_schemas'] as string[] | undefined) ?? [DEFAULT_SCHEMA],
    );
    return facts.tables
        .entries()
        .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))))
        .flatMap(([table, at]): Finding[] => {
            if (!facts.secured.has(table))
                return [finding(input, at, 'row-security', `${table} does not have row level security enabled.`)];
            if (facts.policed.has(table)) return [];
            return [finding(input, at, 'policy', `${table} enables row level security and has no policy.`)];
        })
        .toArray();
}

/**
 * One finding for each foreign key column that no index, primary key or unique key leads with.
 * @param input the engine input
 * @returns the findings
 */
export async function foreignKeyIndexes(input: EngineInput): Promise<Finding[]> {
    const facts = schemaFacts(await migrationsOf(input));
    return facts.foreignKeys
        .filter((key) => facts.indexed.get(key.table)?.has(key.column) !== true)
        .map((key) =>
            finding(
                input,
                key,
                'foreign-key-index',
                `${key.table}.${key.column} is a foreign key and no index leads with it.`,
            ),
        );
}

/**
 * One finding for each grant of every privilege.
 * @param input the engine input
 * @returns the findings
 */
export function explicitGrants(input: EngineInput): Promise<Finding[]> {
    return statementFindings(
        input,
        'grant-all',
        'GRANT ALL gives every privilege, present and future; name the privileges.',
        isGrantAll,
    );
}

/**
 * One finding for each SECURITY DEFINER function that sets no search_path.
 * @param input the engine input
 * @returns the findings
 */
export function definerSearchPath(input: EngineInput): Promise<Finding[]> {
    const text =
        'A SECURITY DEFINER function sets no search_path, so a caller chooses which objects its names resolve to.';
    return statementFindings(input, 'definer-search-path', text, isLooseDefiner);
}
