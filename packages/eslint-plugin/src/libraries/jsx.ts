import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { PlacedRow, TableCell, JsxAttributeValue } from '../types/plugin.ts';

import {
    TABLE_CELLS,
    LAYOUT_ROLES,
    BOOLEAN_TEXTS,
    HTML_ELEMENTS,
    TABLE_SECTIONS,
    HEADER_SEPARATOR,
    MAXIMUM_ROW_SPAN,
    MAXIMUM_COLUMN_SPAN,
} from '../config/accessibility.ts';

/**
Name the element of a JSX tag as written: `table`, `Layout.Table`, or `svg:rect`.

@param name the tag name node of an opening tag.
@returns the name with its member path or namespace.
*/
export function getElementName(name: TSESTree.JSXTagNameExpression): string {
    if (name.type === AST_NODE_TYPES.JSXIdentifier) return name.name;
    if (name.type === AST_NODE_TYPES.JSXNamespacedName) return `${name.namespace.name}:${name.name.name}`;
    return `${getElementName(name.object)}.${name.property.name}`;
}

function normalizeLiteral(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const text = value.toLowerCase();
    return BOOLEAN_TEXTS.has(text) ? text === 'true' : value;
}

function getExpressionValue(expression: TSESTree.Node): unknown {
    if (expression.type === AST_NODE_TYPES.Literal) return normalizeLiteral(expression.value);
    if (expression.type === AST_NODE_TYPES.TemplateLiteral && expression.expressions.length === 0)
        return expression.quasis[0]?.value.cooked;
    return null;
}

function getAttributeValue(value: TSESTree.JSXAttribute['value']): unknown {
    if (value === null) return true;
    const expression = value.type === AST_NODE_TYPES.JSXExpressionContainer ? value.expression : value;
    return getExpressionValue(expression);
}

/**
Get an attribute of a JSX opening tag by its name, in any letter case. The code may write its value as a string,
as a literal in braces, or leave it out for `true`. The strings `"true"` and `"false"` read as booleans.

@param element the opening tag that holds the attributes.
@param name the attribute name to look for.
@returns the attribute and its value, null for a value that only the run time knows, or undefined for no attribute.
*/
export function getAttribute(element: TSESTree.JSXOpeningElement, name: string): JsxAttributeValue | undefined {
    const attribute = element.attributes.find(
        (child): child is TSESTree.JSXAttribute =>
            child.type === AST_NODE_TYPES.JSXAttribute &&
            getElementName(child.name).toLowerCase() === name.toLowerCase(),
    );
    if (attribute === undefined) return undefined;
    return { node: attribute, value: getAttributeValue(attribute.value) };
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

function listRowCells(row: TSESTree.JSXElement, block: { next: number }): TableCell[] | null {
    const cells: TableCell[] = [];
    for (const child of row.children) {
        const name = getCellName(child);
        if (name === undefined) return null;
        if (name === '' || child.type !== AST_NODE_TYPES.JSXElement) continue;
        const [columns, rows] = [
            getSpan(child, 'colspan', MAXIMUM_COLUMN_SPAN),
            getSpan(child, 'rowspan', MAXIMUM_ROW_SPAN),
        ];
        if (Number.isNaN(columns) || Number.isNaN(rows)) return null;
        cells.push(...Array.from({ length: columns }, () => buildCell(child, block.next, rows)));
        block.next += 1;
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

function fillColumns(row: readonly TableCell[], columns: (TableCell | undefined)[]): boolean {
    let next = 0;
    for (const [column, occupant] of columns.entries()) {
        if (occupant !== undefined || next >= row.length) continue;
        columns[column] = row[next];
        next += 1;
    }
    return next > 0;
}

function placeRow(row: readonly TableCell[], columns: (TableCell | undefined)[]): PlacedRow {
    const isUsed = fillColumns(row, columns);
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

function placeRows(rows: readonly (readonly TableCell[])[]): TableCell[][] {
    const columns: (TableCell | undefined)[] = Array.from({ length: rows[0]?.length ?? 0 });
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

/**
Lay out the cells of a JSX table in rows and columns, as a browser does. A cell fills one position for each column and
row that it spans. A `rowspan` of 0 fills the rows that follow.

@param table the table element.
@returns the rows of cells, or null when a component, an expression, or a span from the run time hides the rows.
*/
export function buildTableGrid(table: TSESTree.JSXElement): TableCell[][] | null {
    const block = { next: 0 };
    const rows = listTableRows(table, block);
    return rows === null ? null : placeRows(rows);
}

/**
Tell whether a `role` of `presentation` or `none` marks a JSX table tag as a layout table.

@param element the opening tag.
*/
export function isLayoutTable(element: TSESTree.JSXOpeningElement): boolean {
    const role = getAttribute(element, 'role');
    const isTable = getElementName(element.name).toLowerCase() === 'table';
    return isTable && role !== undefined && LAYOUT_ROLES.has(String(role.value).toLowerCase());
}
