import type { SqlNodeFields } from '#cli/types/parsers.ts';
import { qualifyName } from '#cli/configurations/database/postgres/checks/schema/names.ts';
import type { SchemaState, StatementApplier } from '#cli/types/configurations/database.ts';
import { SCHEMA_NAME_INDEX, POLICY_SCHEMA_INDEX } from '#cli/config/configurations/postgres.ts';

export function dropPolicy(state: SchemaState, _name: string, names: string[]): void {
    state.policies
        .get(qualifyName(names.at(POLICY_SCHEMA_INDEX), names.at(SCHEMA_NAME_INDEX)))
        ?.delete(names.at(-1) ?? '');
}

export const applyCreatePolicy: StatementApplier<'CreatePolicyStmt'> = (statement, state) => {
    const { fields } = statement;
    const table = qualifyName(fields.table?.schemaname, fields.table?.relname);
    const policies = state.policies.get(table) ?? new Map<string, SqlNodeFields['CreatePolicyStmt']>();
    policies.set(fields.policy_name ?? '', fields);
    state.policies.set(table, policies);
};

export const applyAlterPolicy: StatementApplier<'AlterPolicyStmt'> = (statement, state) => {
    const { fields } = statement;
    const policies = state.policies.get(qualifyName(fields.table?.schemaname, fields.table?.relname));
    const policy = policies?.get(fields.policy_name ?? '');
    if (policy !== undefined) policies?.set(fields.policy_name ?? '', { ...policy, ...fields });
};
