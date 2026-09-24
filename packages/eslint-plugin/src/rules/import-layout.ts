// Imports grouped and sorted by statement shape and length: one-line imports first, multi-line second, each by length.
import { createRule } from '#plugin/rules/definition.ts';
import { optionsSchema } from '#plugin/rules/options.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

const BLANK = /^\s*$/u;
const SPACES = /\s+/gu;

function isRequireCall(node: TSESTree.Node | null | undefined): boolean {
    return (
        node?.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length === 1
    );
}

function isOwnLineComment(text: string, comment: TSESTree.Comment, before: number): boolean {
    if (!BLANK.test(text.slice(comment.range[1], before))) return false;
    const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    return BLANK.test(text.slice(lineStart, comment.range[0]));
}

function segmentStart(source: TSESLint.SourceCode, node: TSESTree.Statement): number {
    const text = source.getText();
    let start = node.range[0];
    for (const comment of source.getCommentsBefore(node).toReversed()) {
        if (!isOwnLineComment(text, comment, start)) break;
        start = comment.range[0];
    }
    return start;
}

function segmentEnd(source: TSESLint.SourceCode, node: TSESTree.Statement): number {
    const text = source.getText();
    let end = node.range[1];
    for (const comment of source.getCommentsAfter(node)) {
        if (!BLANK.test(text.slice(end, comment.range[0])) || comment.loc.start.line !== node.loc.end.line) break;
        end = comment.range[1];
    }
    return end;
}

function compareText(left: ImportLayoutEntry, right: ImportLayoutEntry): number {
    if (left.sortText.length !== right.sortText.length) return left.sortText.length - right.sortText.length;
    if (left.sortText !== right.sortText) return left.sortText < right.sortText ? -1 : 1;
    return left.index - right.index;
}

function compare(left: ImportLayoutEntry, right: ImportLayoutEntry): number {
    if (left.multiLine !== right.multiLine) return left.multiLine ? 1 : -1;
    if (left.multiLine && left.lineSpan !== right.lineSpan) return left.lineSpan - right.lineSpan;
    return compareText(left, right);
}

function runsOf(body: TSESTree.Statement[], isRequireAllowed: boolean): TSESTree.Statement[][] {
    const runs: TSESTree.Statement[][] = [];
    let isOpen = false;
    for (const statement of body) {
        const isImport = isImportLike(statement, isRequireAllowed);
        if (isImport && !isOpen) runs.push([]);
        if (isImport) runs.at(-1)?.push(statement);
        isOpen = isImport;
    }
    return runs;
}

function entriesOf(source: TSESLint.SourceCode, run: TSESTree.Statement[]): ImportLayoutEntry[] {
    const text = source.getText();
    const starts = run.map((statement) => segmentStart(source, statement));
    const last = run.at(-1);
    const blockEnd = last === undefined ? 0 : segmentEnd(source, last);
    return run.map((statement, index) => {
        const start = starts[index] ?? statement.range[0];
        const end = starts[index + 1] ?? blockEnd;
        const importText = source.getText(statement);
        return {
            node: statement,
            start,
            end,
            text: text.slice(start, end).trim(),
            sortText: importText.replaceAll(SPACES, ' ').trim(),
            lineSpan: statement.loc.end.line - statement.loc.start.line + 1,
            multiLine: importText.includes('\n'),
            index,
        };
    });
}

function joined(expected: ImportLayoutEntry[]): string {
    let text = '';
    let wasMultiLine = false;
    for (const [index, entry] of expected.entries()) {
        const isGroupChange = entry.multiLine && !wasMultiLine;
        let gap = '\n';
        if (index === 0) gap = '';
        else if (isGroupChange) gap = '\n\n';
        text += `${gap}${entry.text}`;
        wasMultiLine = entry.multiLine;
    }
    return text;
}

/**
 * True for an import declaration or, when asked, a require statement.
 * @param node the statement
 * @param isRequireAllowed whether a top-level require counts as an import
 * @returns whether the statement belongs to the import block
 */
export function isImportLike(node: TSESTree.Statement, isRequireAllowed: boolean): boolean {
    if (node.type === AST_NODE_TYPES.ImportDeclaration) return true;
    if (!isRequireAllowed) return false;
    if (node.type === AST_NODE_TYPES.ExpressionStatement) return isRequireCall(node.expression);
    return (
        node.type === AST_NODE_TYPES.VariableDeclaration &&
        node.declarations.length === 1 &&
        isRequireCall(node.declarations[0].init)
    );
}

export const importLayout = createRule<ImportLayoutOptions, 'layout'>({
    name: 'import-layout',
    meta: {
        type: 'layout',
        fixable: 'code',
        docs: {
            title: 'Import layout',
            example:
                'The import block below reports `layout`:\n\n```ts\nimport { ccc } from "ccc";\nimport a from "a";\n```\n\nPut the shorter import first:\n\n```ts\nimport a from "a";\nimport { ccc } from "ccc";\n```',
            summary:
                'Checks that imports are grouped one-line first, multi-line second, and sorted by length within each group.',
            why: 'One layout for imports means a diff shows the import that changed, not a reshuffle.',
            fix: 'Run gspot check --fix; the rule rewrites the block.',
        },
        schema: [optionsSchema({ allowRequire: { type: 'boolean' } })],
        messages: { layout: 'Imports go one-line first, then multi-line, each sorted by length.' },
    },
    defaultOptions: [{ allowRequire: false }],
    create(context, [options]) {
        const source = context.sourceCode;
        const isRequireAllowed = options.allowRequire === true;
        return {
            Program(node) {
                for (const run of runsOf(node.body, isRequireAllowed)) {
                    const entries = entriesOf(source, run);
                    const [first] = entries;
                    const last = entries.at(-1);
                    if (first === undefined || last === undefined || entries.length < 2) continue;
                    const expected = entries.toSorted(compare);
                    const replacement = joined(expected);
                    if (source.getText().slice(first.start, last.end).trim() === replacement) continue;
                    const misordered = entries.find((entry, index) => entry.node !== expected[index]?.node) ?? first;
                    context.report({
                        node: misordered.node,
                        messageId: 'layout',
                        fix: (fixer) => fixer.replaceTextRange([first.start, last.end], replacement),
                    });
                }
            },
        };
    },
});

export type ImportLayoutEntry = {
    node: TSESTree.Statement;
    start: number;
    end: number;
    text: string;
    sortText: string;
    lineSpan: number;
    multiLine: boolean;
    index: number;
};

export type ImportLayoutOptions = [{ allowRequire?: boolean }];
