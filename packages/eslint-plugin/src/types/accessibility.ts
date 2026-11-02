import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type JsxAttributeValue = { node: TSESTree.JSXAttribute; value: unknown };

export type TableCell = {
    isHeader: boolean;
    headers: string[] | undefined;
    id: string | undefined;
    node: TSESTree.JSXElement;
    block: number;
    rowSpan: number;
};

export type PlacedRow = { cells: TableCell[]; isUsed: boolean; isOpen: boolean };

export type TableBlock = {
    cell: TableCell;
    firstRow: number;
    lastRow: number;
    firstColumn: number;
    lastColumn: number;
};

export type HeaderIssue = TSESLint.ReportDescriptor<'otherHeader' | 'unknownHeader'>;
