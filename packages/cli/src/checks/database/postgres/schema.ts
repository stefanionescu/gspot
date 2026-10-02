import type { SqlNode } from '#cli/types/parsers/sql.ts';
import { textOf, nodesOf, partsOf } from '#cli/parsers/sql/pg.ts';
import { KEY_KINDS, DEFAULT_SCHEMA, CONSTRAINT_SUFFIXES } from '#cli/config/checks/database.ts';
import type { Reader, Schema, Location, Migration, SchemaState } from '#cli/types/checks/database.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four readers qualify a relation name, and the default schema is applied in one place.
function qualified(relation: unknown): string {
    const node = (relation ?? {}) as SqlNode;
    return `${textOf(node['schemaname']) || DEFAULT_SCHEMA}.${textOf(node['relname'])}`;
}

function forgetTable(fields: SchemaState, table: string): void {
    fields.tables.delete(table);
    fields.secured.delete(table);
    fields.policies.delete(table);
    fields.constraints.delete(table);
    fields.indexes = fields.indexes.filter((index) => index.table !== table);
}

function named(parts: string[]): string {
    const name = parts.at(-1) ?? '';
    const schema = parts.length === 1 ? DEFAULT_SCHEMA : (parts.slice(0, -1).at(-1) ?? DEFAULT_SCHEMA);
    return `${schema}.${name}`;
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
function recordForeignKey(fields: SchemaState, at: Location, name: string, columns: string[]): void {
    const constraints = fields.constraints.get(at.table) ?? new Map<string, Schema['foreignKeys']>();
    const keys = columns.map((column) => ({
        table: at.table,
        column,
        path: at.migration.path,
        offset: at.statement.start,
        text: at.migration.text,
    }));
    constraints.set(name, keys);
    fields.constraints.set(at.table, constraints);
}

// One constraint of a table: a foreign key is recorded, and a primary or unique key counts as an index on its first
// column.
function constraint(fields: SchemaState, at: Location, node: SqlNode, column?: string): void {
    const kind = textOf(node['contype']);
    const keys = column === undefined ? partsOf(node['keys']) : [column];
    const columns = column === undefined ? partsOf(node['fk_attrs']) : [column];
    const isForeign = kind === 'CONSTR_FOREIGN';
    const name = constraintName(node, at.table, kind, isForeign ? columns : keys);
    const [first] = keys;
    if (KEY_KINDS.has(kind) && first !== undefined)
        fields.indexes.push({ table: at.table, name, column: first, constraint: name });
    if (isForeign) recordForeignKey(fields, at, name, columns);
}

const created: Reader = (fields, migration, statement) => {
    const table = qualified(statement.fields['relation']);
    if (fields.tables.has(table) && statement.fields['if_not_exists'] === true) return;
    forgetTable(fields, table);
    const at = { migration, statement, table };
    fields.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = nodesOf(statement.fields['tableElts'], 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        nodesOf(column['constraints'], 'Constraint').map((node) => ({ node, column: textOf(column['colname']) })),
    );
    for (const entry of inColumns) constraint(fields, at, entry.node, entry.column);
    const inTable = nodesOf(statement.fields['tableElts'], 'Constraint');
    for (const node of inTable) constraint(fields, at, node);
};

// What each `ALTER TABLE` command changes in the fields.
const ALTERATIONS: Record<string, (fields: SchemaState, at: Location, command: SqlNode) => void> = {
    AT_EnableRowSecurity: (fields, at) => fields.secured.add(at.table),
    AT_DisableRowSecurity: (fields, at) => fields.secured.delete(at.table),
    AT_DropConstraint: (fields, at, command) => {
        const name = textOf(command['name']);
        fields.constraints.get(at.table)?.delete(name);
        fields.indexes = fields.indexes.filter((index) => index.table !== at.table || index.constraint !== name);
    },
    AT_AddConstraint: (fields, at, command) => {
        const node = (command['def'] as SqlNode | undefined)?.['Constraint'] as SqlNode | undefined;
        if (node !== undefined) constraint(fields, at, node);
    },
};

const altered: Reader = (fields, migration, statement) => {
    const at: Location = { migration, statement, table: qualified(statement.fields['relation']) };
    for (const command of nodesOf(statement.fields['cmds'], 'AlterTableCmd'))
        ALTERATIONS[String(command['subtype'])]?.(fields, at, command);
};

// A dropped table leaves the fields, so the checks ask nothing of a table the schema does not hold.
const dropped: Reader = (fields, _migration, statement) => {
    for (const item of nodesOf(statement.fields['objects'], 'List')) {
        const parts = partsOf(item['items']);
        switch (statement.fields['removeType']) {
            case 'OBJECT_TABLE': {
                forgetTable(fields, named(parts));
                break;
            }
            case 'OBJECT_POLICY': {
                const policy = parts.at(-1);
                if (policy !== undefined) fields.policies.get(named(parts.slice(0, -1)))?.delete(policy);
                break;
            }
            case 'OBJECT_INDEX': {
                const name = named(parts);
                fields.indexes = fields.indexes.filter(
                    (index) => `${index.table.slice(0, index.table.indexOf('.'))}.${index.name}` !== name,
                );
                break;
            }
        }
    }
};

const READERS: Record<string, Reader> = {
    DropStmt: dropped,
    CreateStmt: created,
    AlterTableStmt: altered,
    CreatePolicyStmt: (fields, _migration, statement) => {
        const table = qualified(statement.fields['table']);
        const policies = fields.policies.get(table) ?? new Set<string>();
        policies.add(textOf(statement.fields['policy_name']));
        fields.policies.set(table, policies);
    },
    IndexStmt: (fields, _migration, statement) => {
        const [first] = nodesOf(statement.fields['indexParams'], 'IndexElem');
        const column = textOf(first?.['name']);
        if (column === '') return;
        const table = qualified(statement.fields['relation']);
        fields.indexes.push({ table, name: textOf(statement.fields['idxname']), column, constraint: '' });
    },
};
// The fields the checks read: policed tables, every foreign key, and the indexed columns of each table.
function summarized(fields: SchemaState): Schema {
    const policed = new Set([...fields.policies].filter(([, policies]) => policies.size > 0).map(([table]) => table));
    const foreignKeys = [...fields.constraints.values()].flatMap((constraints) => [...constraints.values()].flat());
    const indexed = new Map<string, Set<string>>();
    for (const index of fields.indexes) {
        const columns = indexed.get(index.table) ?? new Set<string>();
        columns.add(index.column);
        indexed.set(index.table, columns);
    }
    return { tables: fields.tables, secured: fields.secured, policed, foreignKeys, indexed };
}

/**
 * Reads every migration in order and gathers what they declare.
 * @param migrations the migrations, in version order
 * @returns the fields
 */
export function schema(migrations: Migration[]): Schema {
    const fields: SchemaState = {
        policies: new Map(),
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) READERS[statement.kind]?.(fields, migration, statement);
    return summarized(fields);
}
