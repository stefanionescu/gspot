import type { SqlNode } from '#cli/types/parsers/sql.ts';
import { textOf, nodesOf, partsOf } from '#cli/parsers/sql/pg.ts';
import type { Schema, Location, Migration, SchemaState, StatementReader } from '#cli/types/checks/database/postgres.ts';

import {
    KEY_KINDS,
    PUBLIC_SCHEMA,
    SCHEMA_PART_INDEX,
    CONSTRAINT_SUFFIXES,
} from '#cli/config/checks/database/postgres.ts';

function qualifyRelation(relation: unknown): string {
    if (relation === undefined || relation === null) return `${PUBLIC_SCHEMA}.`;
    const node = relation as SqlNode;
    return `${textOf(node['schemaname']) || PUBLIC_SCHEMA}.${textOf(node['relname'])}`;
}

function forgetTable(state: SchemaState, table: string): void {
    state.tables.delete(table);
    state.secured.delete(table);
    state.policies.delete(table);
    state.constraints.delete(table);
    state.indexes = state.indexes.filter((index) => index.table !== table);
}

function qualifyParts(parts: string[]): string {
    return `${parts.at(SCHEMA_PART_INDEX) ?? PUBLIC_SCHEMA}.${parts.at(-1) ?? ''}`;
}

// The name Postgres gives an unnamed constraint: the table, the key columns except for a primary key, and a suffix.
function constraintName(node: SqlNode, table: string, kind: string, keys: string[]): string {
    const declared = textOf(node['conname']);
    if (declared !== '') return declared;
    const tableName = table.slice(table.indexOf('.') + 1);
    const suffix = CONSTRAINT_SUFFIXES[kind] ?? 'fkey';
    return [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
}

// Records a foreign key's columns under the constraint name, with where the constraint was declared.
function recordForeignKey(state: SchemaState, at: Location, name: string, columns: string[]): void {
    const constraints = state.constraints.get(at.table) ?? new Map<string, Schema['foreignKeys']>();
    const keys = columns.map((column) => ({
        table: at.table,
        column,
        path: at.migration.path,
        offset: at.statement.start,
        text: at.migration.text,
    }));
    constraints.set(name, keys);
    state.constraints.set(at.table, constraints);
}

// One constraint of a table: a foreign key is recorded, and a primary or unique key counts as an index on its first
// column.
function recordConstraint(state: SchemaState, at: Location, node: SqlNode, column?: string): void {
    const kind = textOf(node['contype']);
    const keys = column === undefined ? partsOf(node['keys']) : [column];
    const columns = column === undefined ? partsOf(node['fk_attrs']) : [column];
    const isForeign = kind === 'CONSTR_FOREIGN';
    const name = constraintName(node, at.table, kind, isForeign ? columns : keys);
    const [first] = keys;
    if (KEY_KINDS.has(kind) && first !== undefined)
        state.indexes.push({ table: at.table, name, column: first, constraint: name });
    if (isForeign) recordForeignKey(state, at, name, columns);
}

const readCreateTable: StatementReader = (state, migration, statement) => {
    const table = qualifyRelation(statement.fields['relation']);
    if (state.tables.has(table) && statement.fields['if_not_exists'] === true) return;
    forgetTable(state, table);
    const at = { migration, statement, table };
    state.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = nodesOf(statement.fields['tableElts'], 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        nodesOf(column['constraints'], 'Constraint').map((node) => ({ node, column: textOf(column['colname']) })),
    );
    for (const entry of inColumns) recordConstraint(state, at, entry.node, entry.column);
    const inTable = nodesOf(statement.fields['tableElts'], 'Constraint');
    for (const node of inTable) recordConstraint(state, at, node);
};

// What each `ALTER TABLE` command changes in the state.
const ALTERATIONS: Record<string, (state: SchemaState, at: Location, command: SqlNode) => void> = {
    AT_EnableRowSecurity: (state, at) => state.secured.add(at.table),
    AT_DisableRowSecurity: (state, at) => state.secured.delete(at.table),
    AT_DropConstraint: (state, at, command) => {
        const name = textOf(command['name']);
        state.constraints.get(at.table)?.delete(name);
        state.indexes = state.indexes.filter((index) => index.table !== at.table || index.constraint !== name);
    },
    AT_AddConstraint: (state, at, command) => {
        const node = (command['def'] as SqlNode | undefined)?.['Constraint'] as SqlNode | undefined;
        if (node !== undefined) recordConstraint(state, at, node);
    },
};

const readAlterTable: StatementReader = (state, migration, statement) => {
    const at: Location = { migration, statement, table: qualifyRelation(statement.fields['relation']) };
    for (const command of nodesOf(statement.fields['cmds'], 'AlterTableCmd'))
        ALTERATIONS[String(command['subtype'])]?.(state, at, command);
};

// A dropped table leaves the state, so the checks ask nothing of a table the schema does not hold.
const readDrop: StatementReader = (state, _migration, statement) => {
    for (const item of nodesOf(statement.fields['objects'], 'List')) {
        const parts = partsOf(item['items']);
        switch (statement.fields['removeType']) {
            case 'OBJECT_TABLE': {
                forgetTable(state, qualifyParts(parts));
                break;
            }
            case 'OBJECT_POLICY': {
                const policy = parts.at(-1);
                if (policy !== undefined) state.policies.get(qualifyParts(parts.slice(0, -1)))?.delete(policy);
                break;
            }
            case 'OBJECT_INDEX': {
                const name = qualifyParts(parts);
                state.indexes = state.indexes.filter(
                    (index) => `${index.table.slice(0, index.table.indexOf('.'))}.${index.name}` !== name,
                );
                break;
            }
        }
    }
};

const READERS: Record<string, StatementReader> = {
    DropStmt: readDrop,
    CreateStmt: readCreateTable,
    AlterTableStmt: readAlterTable,
    CreatePolicyStmt: (state, _migration, statement) => {
        const table = qualifyRelation(statement.fields['table']);
        const policies = state.policies.get(table) ?? new Set<string>();
        policies.add(textOf(statement.fields['policy_name']));
        state.policies.set(table, policies);
    },
    IndexStmt: (state, _migration, statement) => {
        const [first] = nodesOf(statement.fields['indexParams'], 'IndexElem');
        const column = textOf(first?.['name']);
        if (column === '') return;
        const table = qualifyRelation(statement.fields['relation']);
        state.indexes.push({ table, name: textOf(statement.fields['idxname']), column, constraint: '' });
    },
};
// The state the checks read: policed tables, every foreign key, and the indexed columns of each table.
function summarize(state: SchemaState): Schema {
    const policed = new Set([...state.policies].filter(([, policies]) => policies.size > 0).map(([table]) => table));
    const foreignKeys = [...state.constraints.values()].flatMap((constraints) => [...constraints.values()].flat());
    const indexed = new Map<string, Set<string>>();
    for (const index of state.indexes) {
        const columns = indexed.get(index.table) ?? new Set<string>();
        columns.add(index.column);
        indexed.set(index.table, columns);
    }
    return { tables: state.tables, secured: state.secured, policed, foreignKeys, indexed };
}

/**
 * Reads every migration in order and gathers what they declare.
 * @param migrations the migrations, in version order
 * @returns the schema summary
 */
export function buildSchema(migrations: Migration[]): Schema {
    const state: SchemaState = {
        policies: new Map(),
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) READERS[statement.kind]?.(state, migration, statement);
    return summarize(state);
}
