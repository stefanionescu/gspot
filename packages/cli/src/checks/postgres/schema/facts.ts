import { nodesOf, partsOf, textOf } from '#cli/parsers/sql/tree.ts';
// What the migrations declare, gathered across every file: tables, row security, policies, foreign keys and indexes.
export const DEFAULT_SCHEMA = 'public';
import type { SqlNode, SqlStatementView } from '#cli/parsers/sql/types.ts';
import type { Migration, SchemaFacts } from '#cli/checks/postgres/types.ts';

function qualified(relation: unknown): string {
    const node = (relation ?? {}) as SqlNode;
    return `${textOf(node['schemaname']) || DEFAULT_SCHEMA}.${textOf(node['relname'])}`;
}

type SchemaState = SchemaFacts & {
    policies: Map<string, Set<string>>;
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, SchemaFacts['foreignKeys']>>;
};
type FactReader = (facts: SchemaState, migration: Migration, statement: SqlStatementView) => void;

function forgetTable(facts: SchemaState, table: string): void {
    facts.tables.delete(table);
    facts.secured.delete(table);
    facts.policies.delete(table);
    facts.constraints.delete(table);
    facts.indexes = facts.indexes.filter((index) => index.table !== table);
}

function named(parts: string[]): string {
    return `${parts.length === 1 ? DEFAULT_SCHEMA : parts.at(-2)}.${parts.at(-1)}`;
}

const KEY_KINDS = new Set(['CONSTR_PRIMARY', 'CONSTR_UNIQUE']);

// One constraint of a table: a foreign key is recorded, and a primary or unique key counts as an index on its first column.
function constraint(
    facts: SchemaState,
    at: { migration: Migration; statement: SqlStatementView; table: string },
    node: SqlNode,
    column?: string,
): void {
    const kind = textOf(node['contype']);
    const [first] = column === undefined ? partsOf(node['keys']) : [column];
    const columns = column === undefined ? partsOf(node['fk_attrs']) : [column];
    const tableName = at.table.slice(at.table.indexOf('.') + 1);
    const suffix = kind === 'CONSTR_PRIMARY' ? 'pkey' : kind === 'CONSTR_UNIQUE' ? 'key' : 'fkey';
    const keys = kind === 'CONSTR_FOREIGN' ? columns : column === undefined ? partsOf(node['keys']) : [column];
    const name = textOf(node['conname']) || [tableName, ...(kind === 'CONSTR_PRIMARY' ? [] : keys), suffix].join('_');
    if (KEY_KINDS.has(kind) && first !== undefined) {
        facts.indexes.push({ table: at.table, name, column: first, constraint: name });
    }
    if (kind !== 'CONSTR_FOREIGN') return;
    const constraints = facts.constraints.get(at.table) ?? new Map();
    constraints.set(
        name,
        columns.map((name) => ({
            table: at.table,
            column: name,
            path: at.migration.path,
            offset: at.statement.start,
            text: at.migration.text,
        })),
    );
    facts.constraints.set(at.table, constraints);
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

const altered: FactReader = (facts, migration, statement) => {
    const table = qualified(statement.fields['relation']);
    const commands = nodesOf(statement.fields['cmds'], 'AlterTableCmd');
    for (const command of commands) {
        if (command['subtype'] === 'AT_EnableRowSecurity') facts.secured.add(table);
        if (command['subtype'] === 'AT_DisableRowSecurity') facts.secured.delete(table);
        if (command['subtype'] === 'AT_DropConstraint') {
            const name = textOf(command['name']);
            facts.constraints.get(table)?.delete(name);
            facts.indexes = facts.indexes.filter((index) => index.table !== table || index.constraint !== name);
        }
        if (command['subtype'] !== 'AT_AddConstraint') continue;
        const node = (command['def'] as SqlNode | undefined)?.['Constraint'] as SqlNode | undefined;
        if (node !== undefined) constraint(facts, { migration, statement, table }, node);
    }
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
                facts.policies.get(named(parts.slice(0, -1)))?.delete(parts.at(-1)!);
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
        policed: new Set(),
        foreignKeys: [],
        indexed: new Map(),
    };
    for (const migration of migrations)
        for (const statement of migration.statements) READERS[statement.kind]?.(facts, migration, statement);
    for (const [table, policies] of facts.policies) if (policies.size > 0) facts.policed.add(table);
    for (const constraints of facts.constraints.values())
        for (const keys of constraints.values()) facts.foreignKeys.push(...keys);
    for (const index of facts.indexes) {
        const columns = facts.indexed.get(index.table) ?? new Set<string>();
        columns.add(index.column);
        facts.indexed.set(index.table, columns);
    }
    return {
        tables: facts.tables,
        secured: facts.secured,
        policed: facts.policed,
        foreignKeys: facts.foreignKeys,
        indexed: facts.indexed,
    };
}
