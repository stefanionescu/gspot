import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import {
    BOOLEAN_TEXTS,
    HEADER_SEPARATOR,
    HTML_ELEMENTS,
    LAYOUT_ROLES,
    MAXIMUM_COLUMN_SPAN,
    MAXIMUM_ROW_SPAN,
    TABLE_CELLS,
    TABLE_SECTIONS,
} from '../config/accessibility.ts';
import type { JsxAttributeValue, PlacedRow, TableCell } from '../types/accessibility.ts';

function normalizeLiteral(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const text = value.toLowerCase();
    return BOOLEAN_TEXTS.has(text) ? text === 'true' : value;
}

function getExpressionValue(expression: TSESTree.Node): unknown {
    if (expression.type === AST_NODE_TYPES.Literal) return normalizeLiteral(expression.value);
    return expression.type === AST_NODE_TYPES.TemplateLiteral && expression.expressions.length === 0
        ? expression.quasis[0]?.value.cooked
        : null;
}

function getAttributeValue(value: TSESTree.JSXAttribute['value']): unknown {
    if (value === null) return true;
    const expression = value.type === AST_NODE_TYPES.JSXExpressionContainer ? value.expression : value;
    return getExpressionValue(expression);
}

function getSpan(cell: TSESTree.JSXElement, name: string, maximum: number): number {
    const attribute = getAttribute(cell.openingElement, name);
    const span = attribute ? Number.parseInt(String(attribute.value)) : 1;
    return name === 'rowspan' && span === 0 ? 0 : Math.min(Math.max(span, 1), maximum);
}

function buildCell(cell: TSESTree.JSXElement, block: number, rowSpan: number): TableCell {
    const headers = getAttribute(cell.openingElement, 'headers')?.value;
    const id = getAttribute(cell.openingElement, 'id');
    return {
        isHeader:
            cell.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier && cell.openingElement.name.name === 'th',
        headers:
            Boolean(headers) && String(headers).trim() !== '' ? String(headers).split(HEADER_SEPARATOR) : undefined,
        id: id === undefined ? undefined : String(id.value),
        node: cell,
        block,
        rowSpan,
    };
}

function getCellName(child: TSESTree.JSXChild): string | undefined {
    if (child.type === AST_NODE_TYPES.JSXText) return '';
    if (child.type === AST_NODE_TYPES.JSXExpressionContainer)
        return child.expression.type === AST_NODE_TYPES.JSXEmptyExpression ? '' : undefined;
    const name = child.type === AST_NODE_TYPES.JSXElement ? child.openingElement.name : undefined;
    return name?.type === AST_NODE_TYPES.JSXIdentifier && TABLE_CELLS.has(name.name) ? name.name : undefined;
}

function listSpannedCells(cell: TSESTree.JSXElement, block: { next: number }): TableCell[] | null {
    const columns = getSpan(cell, 'colspan', MAXIMUM_COLUMN_SPAN);
    const rows = getSpan(cell, 'rowspan', MAXIMUM_ROW_SPAN);
    if (Number.isNaN(columns) || Number.isNaN(rows)) return null;
    const cells = Array.from({ length: columns }, () => buildCell(cell, block.next, rows));
    block.next += 1;
    return cells;
}

function listRowCells(row: TSESTree.JSXElement, block: { next: number }): TableCell[] | null {
    const cells: TableCell[] = [];
    for (const child of row.children) {
        const name = getCellName(child);
        if (name === undefined) return null;
        if (name === '' || child.type !== AST_NODE_TYPES.JSXElement) continue;
        const spanned = listSpannedCells(child, block);
        if (spanned === null) return null;
        cells.push(...spanned);
    }
    return cells;
}

function getTableElement(child: TSESTree.JSXElement, block: { next: number }): TableCell[][] | null {
    const tag = child.openingElement.name;
    const name = getElementName(tag).toLowerCase();
    if (TABLE_SECTIONS.has(name)) return listTableRows(child, block);
    if (name !== 'tr')
        return name === 'table' || (tag.type === AST_NODE_TYPES.JSXIdentifier && HTML_ELEMENTS.has(tag.name))
            ? []
            : null;
    const cells = listRowCells(child, block);
    return cells === null ? null : [cells];
}

function getTableChild(child: TSESTree.JSXChild, block: { next: number }): TableCell[][] | null {
    if (child.type === AST_NODE_TYPES.JSXFragment) return listTableRows(child, block);
    if (child.type === AST_NODE_TYPES.JSXExpressionContainer)
        return child.expression.type === AST_NODE_TYPES.JSXEmptyExpression ? [] : null;
    return child.type === AST_NODE_TYPES.JSXElement ? getTableElement(child, block) : [];
}

function listTableRows(
    container: TSESTree.JSXElement | TSESTree.JSXFragment,
    block: { next: number },
): TableCell[][] | null {
    const rows: TableCell[][] = [];
    for (const child of container.children) {
        const found = getTableChild(child, block);
        if (found === null) return null;
        rows.push(...found);
    }
    return rows;
}

function fillColumns(row: readonly TableCell[], columns: Array<TableCell | undefined>): number {
    let next = 0;
    for (const [column, occupant] of columns.entries()) {
        if (occupant !== undefined || next >= row.length) continue;
        columns[column] = row[next];
        next += 1;
    }
    return next;
}

function placeRow(row: readonly TableCell[], columns: Array<TableCell | undefined>): PlacedRow {
    const isUsed = fillColumns(row, columns) > 0;
    const cells = columns.filter((cell) => cell !== undefined);
    let isOpen = true;
    for (const [column, cell] of columns.entries()) {
        if (cell === undefined || cell.rowSpan === 0) continue;
        isOpen = false;
        cell.rowSpan -= 1;
        if (cell.rowSpan === 0) columns[column] = undefined;
    }
    return { cells, isUsed, isOpen };
}

function placeRows(rows: ReadonlyArray<readonly TableCell[]>): TableCell[][] {
    const columns: Array<TableCell | undefined> = Array.from({ length: rows[0]?.length ?? 0 });
    const grid: TableCell[][] = [];
    for (const row of rows) {
        let isUsed = false;
        while (!isUsed) {
            const placed = placeRow(row, columns);
            if (placed.isOpen) return grid;
            grid.push(placed.cells);
            ({ isUsed } = placed);
        }
    }
    return grid;
}

export function getElementName(name: TSESTree.JSXTagNameExpression): string {
    if (name.type === AST_NODE_TYPES.JSXIdentifier) return name.name;
    return name.type === AST_NODE_TYPES.JSXNamespacedName
        ? `${name.namespace.name}:${name.name.name}`
        : `${getElementName(name.object)}.${name.property.name}`;
}

/**
Get an attribute of a JSX opening tag by its name, in any letter case. The code may write its value as a string,
as a literal in braces, or leave it out for `true`. The strings `"true"` and `"false"` read as booleans.
*/
export function getAttribute(element: TSESTree.JSXOpeningElement, name: string): JsxAttributeValue | undefined {
    const attribute = element.attributes.find(
        (child): child is TSESTree.JSXAttribute =>
            child.type === AST_NODE_TYPES.JSXAttribute &&
            getElementName(child.name).toLowerCase() === name.toLowerCase(),
    );
    return attribute === undefined ? undefined : { node: attribute, value: getAttributeValue(attribute.value) };
}

/**
Lay out the cells of a JSX table in rows and columns, as a browser does. A cell fills one position for each column and
row that it spans. A `rowspan` of 0 fills the rows that follow.
*/
export function buildTableGrid(table: TSESTree.JSXElement): TableCell[][] | null {
    const block = { next: 0 };
    const rows = listTableRows(table, block);
    return rows === null ? null : placeRows(rows);
}

export function isLayoutTable(element: TSESTree.JSXOpeningElement): boolean {
    const role = getAttribute(element, 'role');
    const isTable = getElementName(element.name).toLowerCase() === 'table';
    return isTable && role !== undefined && LAYOUT_ROLES.has(String(role.value).toLowerCase());
}
