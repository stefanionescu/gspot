import {
    IDENTITY_CALL_MESSAGE,
    IDENTITY_FUNCTIONS,
    OPEN_POLICY_MESSAGE,
    POLICY_ROLES_MESSAGE,
    POLICY_RULES,
    ROW_SECURITY_RULE,
    SECURITY_INVOKER_MESSAGE,
    SQL_COMMENT,
} from '#cli/config/configurations/infrastructure.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema.ts';
import { ROW_SECURITY_EXPLANATIONS } from '#cli/configurations/database/postgres/explanations.ts';
import { findNodeFields, listNodeFields, selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { isTable } from '#cli/system/tables.ts';
import { getPosition } from '#cli/system/text.ts';
import type { Migration } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { SqlNodeFields, SqlStatement } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function listIdentityCalls(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap((child) => listIdentityCalls(child));
    if (!isTable(node) || 'SubLink' in node) return [];
    const call = node['FuncCall'] as SqlNodeFields['FuncCall'] | undefined;
    const name = listNodeFields(call?.funcname, 'String')
        .map(({ sval }) => sval)
        .join('.');
    return [
        ...(IDENTITY_FUNCTIONS.has(name) ? [name] : []),
        ...Object.values(node).flatMap((child) => listIdentityCalls(child)),
    ];
}

function isUnexplainedOpenPolicy(migration: Migration, statement: SqlStatement<'CreatePolicyStmt'>): boolean {
    if (findNodeFields(statement.fields.qual, 'A_Const')?.boolval?.boolval !== true) return false;
    const { text } = migration;
    const lineStart = text.lastIndexOf('\n', text.lastIndexOf('\n', statement.start - 1) - 1) + 1;
    const lineEnd = text.indexOf('\n', text.indexOf(';', statement.start));
    return !SQL_COMMENT.test(text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd));
}

function listPolicyFindings(migration: Migration, statement: SqlStatement): CheckFinding[] {
    if (statement.kind !== 'CreatePolicyStmt') return [];
    const policy = statement.fields;
    const [role] = listNodeFields(policy.roles, 'RoleSpec');
    const position = { file: migration.path, ...getPosition(migration.text, statement.start) };
    return [
        ...(role?.location === -1 ? [{ ...position, rule: POLICY_RULES.roles, message: POLICY_ROLES_MESSAGE }] : []),
        ...listIdentityCalls([policy.qual, policy.with_check]).map(() => ({
            ...position,
            rule: POLICY_RULES.identityCall,
            message: IDENTITY_CALL_MESSAGE,
        })),
        ...(isUnexplainedOpenPolicy(migration, statement)
            ? [{ ...position, rule: POLICY_RULES.open, message: OPEN_POLICY_MESSAGE }]
            : []),
    ];
}

/**
Reports each table in a client schema with row security off, and each client view that skips it. In the migrations
after the frozen ones, reports each policy that names no role, calls an identity function per row, or opens a table with
no comment.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
*/
async function checkRowLevelSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildDatabaseSchema(migrations);
    const settings = getTable(planned.scope.settings, 'postgres');
    const schemas = new Set(settings['client_schemas']);
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        settings.frozen_through,
    );
    return [
        ...schema.tables
            .entries()
            .filter(([table]) => schemas.has(table.slice(0, table.indexOf('.'))) && !schema.secured.has(table))
            .map(([table, at]) => ({
                file: at.path,
                ...getPosition(at.text, at.offset),
                rule: ROW_SECURITY_RULE,
                message: `${table} does not have row level security enabled.`,
            })),
        ...schema.unprotectedViews
            .entries()
            .filter(([view]) => schemas.has(view.slice(0, view.indexOf('.'))))
            .map(([, at]) => ({
                file: at.path,
                ...getPosition(at.text, at.offset),
                rule: POLICY_RULES.view,
                message: SECURITY_INVOKER_MESSAGE,
            })),
        ...migrations
            .filter(({ path }) => !frozen.has(path))
            .flatMap((migration) =>
                migration.statements.flatMap((statement) => listPolicyFindings(migration, statement)),
            ),
    ];
}

export const ROW_LEVEL_SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/row-level-security': { check: checkRowLevelSecurity, explanations: ROW_SECURITY_EXPLANATIONS },
};
