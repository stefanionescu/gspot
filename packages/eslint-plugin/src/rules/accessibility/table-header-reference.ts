import { createRule } from '../../rule.ts';
import { buildTableGrid, getElementName } from '../../libraries/jsx.ts';
import type { TableCell, TableBlock, HeaderIssue } from '../../types/accessibility.ts';

function listHeaderIds(cells: readonly (TableCell | undefined)[]): Set<string> {
    const ids = cells.flatMap((cell) =>
        cell?.isHeader === true && cell.id !== undefined && cell.id !== '' ? [cell.id] : [],
    );
    return new Set(ids);
}

function listBlocks(grid: readonly (readonly TableCell[])[]): TableBlock[] {
    const positions = grid.flatMap((cells, row) => cells.map((cell, column) => ({ cell, row, column })));
    const blocks = new Map<number, TableBlock>();
    for (const { cell, row, column } of positions) {
        const block = blocks.get(cell.block);
        if (cell.headers === undefined) continue;
        if (block) Object.assign(block, { lastRow: row, lastColumn: column });
        else blocks.set(cell.block, { cell, firstRow: row, lastRow: row, firstColumn: column, lastColumn: column });
    }
    return [...blocks.values()];
}

function listHeaderIssues(grid: readonly (readonly TableCell[])[]): HeaderIssue[] {
    const rowHeaders = grid.map((cells) => listHeaderIds(cells));
    const columnHeaders = Array.from({ length: grid[0]?.length ?? 0 }, (_, column) =>
        listHeaderIds(grid.map((cells) => cells[column])),
    );
    const allHeaders = new Set([...rowHeaders, ...columnHeaders].flatMap((ids) => [...ids]));
    return listBlocks(grid).flatMap(({ cell, firstRow, lastRow, firstColumn, lastColumn }) => {
        const near = new Set(
            [...columnHeaders.slice(firstColumn, lastColumn + 1), ...rowHeaders.slice(firstRow, lastRow + 1)].flatMap(
                (ids) => [...ids],
            ),
        );
        return (cell.headers ?? [])
            .filter((id) => !near.has(id))
            .map((id) => ({
                node: cell.node,
                messageId: allHeaders.has(id) ? 'otherHeader' : 'unknownHeader',
                data: { id },
            }));
    });
}

export const tableHeaderReference = createRule<[], 'otherHeader' | 'unknownHeader'>({
    name: 'table-header-reference',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `headers` attributes of JSX table cells that name an id that is not the id of a `<th>` in the same row or column of the cell.',
            why: 'Screen readers read the headers that the `headers` attribute names, so a wrong id announces the wrong header or none.',
            fix: 'List in `headers` only the ids of the `<th>` cells of the row and the column of the cell.',
            example:
                'In a table whose header row has `<th id="name">` and `<th id="age">`, the cell `<td headers="email">` reports `unknownHeader`. Use `headers="age"` for the age column.',
        },
        schema: [],
        messages: {
            otherHeader: 'The id "{{id}}" in headers names the header of another row or column.',
            unknownHeader: 'The id "{{id}}" in headers names no <th> header of this table.',
        },
    },
    create(context) {
        return {
            JSXElement(node) {
                const isTable = getElementName(node.openingElement.name) === 'table';
                const issues = isTable ? listHeaderIssues(buildTableGrid(node) ?? []) : [];
                for (const issue of issues) context.report(issue);
            },
        };
    },
});
