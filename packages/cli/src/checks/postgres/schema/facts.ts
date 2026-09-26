import type { SqlNode } from '#cli/types/parsers/sql.ts';
import { nodesOf, partsOf, textOf } from '#cli/parsers/sql/parser.ts';
import type { Migration, SchemaFacts, FactReader, Location, SchemaState } from '#cli/types/checks/postgres.ts';

function qualified(relation: unknown): string {
    const node = (relation ?? {}) as SqlNode;
    return `${textOf(node['schemaname']) || DEFAULT_SCHEMA}.${textOf(node['relname'])}`;
}

function forgetTable(facts: SchemaState, table: string): void {
    facts.tables.delete(table);
    facts.secured.delete(table);
    facts.policies.delete(table);
    facts.constraints.delete(table);
    facts.indexes = facts.indexes.filter((index) => index.table !== table);
}

function named(parts: string[]): string {
    const name = parts.at(-1) ?? '';
    const schema = parts.length === 1 ? DEFAULT_SCHEMA : (parts.slice(0, -1).at(-1) ?? DEFAULT_SCHEMA);
    return `${schema}.${name}`;
}

const KEY_KINDS = new Set(['CONSTR_PRIMARY', 'CONSTR_UNIQUE']);
const CONSTRAINT_SUFFIXES: Record<string, string> = { CONSTR_PRIMARY: 'pkey', CONSTR_UNIQUE: 'key' };

// The name Postgres gives an unnamed constraint: the table, the key columns except for a primary key, and a suffix.
function constraintName(node: SqlNode, table: string, kind: string, keys: string[]): string {
    const declared = textOf(node['conname']);
    if (declared !== '') return declared;
    const tableName = table.slice(table.indexOf('.') + 1);
    const suffix = CONSTRAINT_SUFFIXES[kind] ?? 'fkey';
    return [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
}

// Records a foreign key's columns under the constraint name, with where the constraint was declared.
function recordForeignKey(facts: SchemaState, at: Location, name: string, columns: string[]): void {
    const constraints = facts.constraints.get(at.table) ?? new Map<string, SchemaFacts['foreignKeys']>();
    const keys = columns.map((column) => ({
        table: at.table,
        column,
        path: at.migration.path,
        offset: at.statement.start,
        text: at.migration.text,
    }));
    constraints.set(name, keys);
    facts.constraints.set(at.table, constraints);
}

// One constraint of a table: a foreign key is recorded, and a primary or unique key counts as an index on its first
// column.
function constraint(facts: SchemaState, at: Location, node: SqlNode, column?: string): void {
    const kind = textOf(node['contype']);
    const keys = column === undefined ? partsOf(node['keys']) : [column];
    const columns = column === undefined ? partsOf(node['fk_attrs']) : [column];
    const isForeign = kind === 'CONSTR_FOREIGN';
    const name = constraintName(node, at.table, kind, isForeign ? columns : keys);
    const [first] = keys;
    if (KEY_KINDS.has(kind) && first !== undefined)
        facts.indexes.push({ table: at.table, name, column: first, constraint: name });
    if (isForeign) recordForeignKey(facts, at, name, columns);
}

const created: FactReader = (facts, migration, statement) => {
    const table = qualified(statement.fields['relation']);
    if (facts.tables.has(table) && statement.fields['if_not_exists'] === true) return;
    forgetTable(facts, table);
    const at = { migration, statement, table };
    facts.tables.set(table, { path: migration.path, offset: statement.start, text: migration.text });
    const columns = nodesOf(statement.fields['tableElts'], 'ColumnDef');
    const inColumns = columns.flatMap((column) =>
        nodesOf(column['constraints'], 'Constraint').map((node) => ({ node, column: textOf(column['colname']) })),
    );
    for (const entry of inColumns) constraint(facts, at, entry.node, entry.column);
    const inTable = nodesOf(statement.fields['tableElts'], 'Constraint');
    for (const node of inTable) constraint(facts, at, node);
};

// Forgets a constraint by name: its foreign key and the index a key constraint counted as.
function dropConstraint(facts: SchemaState, table: string, name: string): void {
    facts.constraints.get(table)?.delete(name);
    facts.indexes = facts.indexes.filter((index) => index.table !== table || index.constraint !== name);
}

// What each ALTER TABLE command changes in the facts.
const ALTERATIONS: Record<string, (facts: SchemaState, at: Location, command: SqlNode) => void> = {
    AT_EnableRowSecurity: (facts, at) => facts.secured.add(at.table),
    AT_DisableRowSecurity: (facts, at) => facts.secured.delete(at.table),
    AT_DropConstraint: (facts, at, command) => {
        dropConstraint(facts, at.table, textOf(command['name']));
    },
    AT_AddConstraint: (facts, at, command) => {
        const node = (command['def'] as SqlNode | undefined)?.['Constraint'] as SqlNode | undefined;
        if (node !== undefined) constraint(facts, at, node);
    },
};

const altered: FactReader = (facts, migration, statement) => {
    const at: Location = { migration, statement, table: qualified(statement.fields['relation']) };
    for (const command of nodesOf(statement.fields['cmds'], 'AlterTableCmd'))
        ALTERATIONS[String(command['subtype'])]?.(facts, at, command);
};

// A dropped table leaves the facts, so the checks ask nothing of a table the schema does not hold.
const dropped: FactReader = (facts, _migration, statement) => {
    for (const item of nodesOf(statement.fields['objects'], 'List')) {
        const parts = partsOf(item['items']);
        switch (statement.fields['removeType']) {
            case 'OBJECT_TABLE': {
                forgetTable(facts, named(parts));
                break;
            }
            case 'OBJECT_POLICY': {
                const policy = parts.at(-1);
                if (policy !== undefined) facts.policies.get(named(parts.slice(0, -1)))?.delete(policy);
                break;
            }
            case 'OBJECT_INDEX': {
                const name = named(parts);
                facts.indexes = facts.indexes.filter(
                    (index) => `${index.table.slice(0, index.table.indexOf('.'))}.${index.name}` !== name,
                );
                break;
            }
        }
    }
};

const READERS: Record<string, FactReader> = {
    DropStmt: dropped,
    CreateStmt: created,
    AlterTableStmt: altered,
    CreatePolicyStmt: (facts, _migration, statement) => {
        const table = qualified(statement.fields['table']);
        const policies = facts.policies.get(table) ?? new Set<string>();
        policies.add(textOf(statement.fields['policy_name']));
        facts.policies.set(table, policies);
    },
    IndexStmt: (facts, _migration, statement) => {
        const [first] = nodesOf(statement.fields['indexParams'], 'IndexElem');
        const column = textOf(first?.['name']);
        if (column === '') return;
        const table = qualified(statement.fields['relation']);
        facts.indexes.push({ table, name: textOf(statement.fields['idxname']), column, constraint: '' });
    },
};
// The facts the checks read: policed tables, every foreign key, and the indexed columns of each table.
function summarized(facts: SchemaState): SchemaFacts {
    const policed = new Set([...facts.policies].filter(([, policies]) => policies.size > 0).map(([table]) => table));
    const foreignKeys = [...facts.constraints.values()].flatMap((constraints) => [...constraints.values()].flat());
    const indexed = new Map<string, Set<string>>();
    for (const index of facts.indexes) {
        const columns = indexed.get(index.table) ?? new Set<string>();
        columns.add(index.column);
        indexed.set(index.table, columns);
    }
    return { tables: facts.tables, secured: facts.secured, policed, foreignKeys, indexed };
}

// What the migrations declare, gathered across every file: tables, row security, policies, foreign keys and indexes.
export const DEFAULT_SCHEMA = 'public';

/**
 * Reads every migration in order and gathers what they declare.
 * @param migrations the migrations, in version order
 * @returns the facts
 */
export function schemaFacts(migrations: Migration[]): SchemaFacts {
    const facts: SchemaState = {
        policies: new Map(),
        indexes: [],
        constraints: new Map(),
        tables: new Map(),
        secured: new Set(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) READERS[statement.kind]?.(facts, migration, statement);
    return summarized(facts);
}
