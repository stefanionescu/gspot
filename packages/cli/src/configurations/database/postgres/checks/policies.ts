import type { SqlNodeFields } from '#cli/types/parsers.ts';
import type { SchemaState, StatementApplier } from '#cli/types/configurations/infrastructure.ts';
import { PUBLIC_SCHEMA, SCHEMA_NAME_INDEX, POLICY_SCHEMA_INDEX } from '#cli/config/configurations/infrastructure.ts';

/**
Build the name of a table with its schema.

@param schema the schema, which defaults to public.
@param name the table.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The statement appliers of the schema reader qualify every name the same way.
export function qualifyName(schema: string | undefined, name: string | undefined = ''): string {
    return `${schema === undefined || schema === '' ? PUBLIC_SCHEMA : schema}.${name}`;
}

/**
Forget a policy that a migration drops.

@param state the schema so far.
@param _name the qualified name of the statement, which a policy does not use.
@param names the parts of the dropped name: its schema, its table, and the policy.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The drop appliers of the schema reader share one signature.
export function dropPolicy(state: SchemaState, _name: string, names: string[]): void {
    state.policies
        .get(qualifyName(names.at(POLICY_SCHEMA_INDEX), names.at(SCHEMA_NAME_INDEX)))
        ?.delete(names.at(-1) ?? '');
}

/**
Add a policy that a migration creates to its table.

@param statement the migration step that creates the policy.
@param state the schema so far.
*/
export const applyCreatePolicy: StatementApplier<'CreatePolicyStmt'> = (statement, state) => {
    const { fields } = statement;
    const table = qualifyName(fields.table?.schemaname, fields.table?.relname);
    const policies = state.policies.get(table) ?? new Map<string, SqlNodeFields['CreatePolicyStmt']>();
    policies.set(fields.policy_name ?? '', fields);
    state.policies.set(table, policies);
};

/**
Merge what a migration changes into a policy that exists.

@param statement the migration step that changes the policy.
@param state the schema so far.
*/
export const applyAlterPolicy: StatementApplier<'AlterPolicyStmt'> = (statement, state) => {
    const { fields } = statement;
    const policies = state.policies.get(qualifyName(fields.table?.schemaname, fields.table?.relname));
    const policy = policies?.get(fields.policy_name ?? '');
    if (policy !== undefined) policies?.set(fields.policy_name ?? '', { ...policy, ...fields });
};
