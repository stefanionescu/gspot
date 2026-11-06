import { qualifyName } from '#cli/configurations/database/postgres/checks/policies.ts';
import type { SchemaState, StatementApplier } from '#cli/types/configurations/infrastructure.ts';

function renameColumn(state: SchemaState, table: string, previous: string | undefined, name: string): void {
    const keys = state.constraints.get(table)?.values() ?? [];
    for (const key of keys) key.columns = key.columns.map((column) => (column === previous ? name : column));
    for (const index of state.indexes) {
        if (index.table === table) index.columns = index.columns.map((column) => (column === previous ? name : column));
    }
}

function renameConstraint(state: SchemaState, table: string, previous: string, name: string): void {
    const constraints = state.constraints.get(table);
    const constraint = constraints?.get(previous);
    if (constraint !== undefined) {
        constraints?.delete(previous);
        constraints?.set(name, constraint);
    }
    for (const index of state.indexes) {
        if (index.table !== table || index.constraint !== previous) continue;
        index.constraint = name;
        index.name = name;
    }
}

function renameIndex(state: SchemaState, previous: string, name: string): void {
    const index = state.indexes.find((otherIndex) => qualifyName(otherIndex.schema, otherIndex.name) === previous);
    if (index === undefined) return;
    index.name = name;
}

export function renameTable(state: SchemaState, table: string, renamed: string): void {
    const source = state.tables.get(table);
    if (source !== undefined) {
        state.tables.set(renamed, source);
        state.tables.delete(table);
    }
    if (state.secured.delete(table)) state.secured.add(renamed);
    const policies = state.policies.get(table);
    if (policies !== undefined) {
        state.policies.set(renamed, policies);
        state.policies.delete(table);
    }
    const constraints = state.constraints.get(table);
    if (constraints !== undefined) {
        state.constraints.set(
            renamed,
            new Map([...constraints].map(([constraint, key]) => [constraint, { ...key, table: renamed }])),
        );
        state.constraints.delete(table);
    }
    state.indexes = state.indexes.map((index) =>
        index.table === table ? { ...index, table: renamed, schema: renamed.slice(0, renamed.indexOf('.')) } : index,
    );
}

export const applyRename: StatementApplier<'RenameStmt'> = (statement, state) => {
    const { relation = {}, newname: name = '', subname: previous = '', renameType } = statement.fields;
    const table = qualifyName(relation.schemaname, relation.relname);
    switch (renameType) {
        case 'OBJECT_TABLE': {
            renameTable(state, table, qualifyName(relation.schemaname, name));
            break;
        }
        case 'OBJECT_INDEX': {
            renameIndex(state, table, name);
            break;
        }
        case 'OBJECT_TABCONSTRAINT': {
            renameConstraint(state, table, previous, name);
            break;
        }
        case 'OBJECT_COLUMN': {
            renameColumn(state, table, previous, name);
            break;
        }
        default: {
            break;
        }
    }
};
