import { isTable } from '#cli/system/tables.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import { getPosition } from '#cli/system/text/positions.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Migration } from '#cli/types/configurations/database.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { SqlStatement, SqlNodeFields } from '#cli/types/parsers.ts';
import { findNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import { ROW_SECURITY_EXPLANATIONS } from '#cli/configurations/database/postgres/explanations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema/build.ts';

import {
    readParsedMigrations,
    listUnfrozenMigrations,
} from '#cli/configurations/database/postgres/checks/migrations.ts';
import {
    SQL_COMMENT,
    POLICY_RULES,
    ROW_SECURITY_RULE,
    IDENTITY_FUNCTIONS,
    OPEN_POLICY_MESSAGE,
    POLICY_ROLES_MESSAGE,
    IDENTITY_CALL_MESSAGE,
    SECURITY_INVOKER_MESSAGE,
} from '#cli/config/configurations/postgres.ts';

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

async function checkRowLevelSecurity(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const migrations = await readParsedMigrations(session, planned);
    const schema = buildDatabaseSchema(migrations);
    const schemas = new Set(getTable(planned.scope.settings, 'postgres').client_schemas);
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
        ...listUnfrozenMigrations(migrations, planned).flatMap((migration) =>
            migration.statements.flatMap((statement) => listPolicyFindings(migration, statement)),
        ),
    ];
}

export const ROW_LEVEL_SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'postgres/row-level-security': { check: checkRowLevelSecurity, explanations: ROW_SECURITY_EXPLANATIONS },
};
