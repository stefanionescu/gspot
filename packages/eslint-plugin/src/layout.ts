// Ordering shared by the import and export layout rules: statements by length, then the names inside braces.
import { BLANK, SPACES } from '#plugin/constants/rules.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { LayoutMessages, ImportLayoutEntry } from '#plugin/types/rules.ts';

function isOwnLineComment(text: string, comment: TSESTree.Comment, before: number): boolean {
    if (!BLANK.test(text.slice(comment.range[1], before))) return false;
    const lineStart = text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    return BLANK.test(text.slice(lineStart, comment.range[0]));
}

function segmentStart(source: TSESLint.SourceCode, node: TSESTree.Node): number {
    const text = source.getText();
    let start = node.range[0];
    for (const comment of source.getCommentsBefore(node).toReversed()) {
        if (!isOwnLineComment(text, comment, start)) break;
        if (BLANK.test(text.slice(0, comment.range[0]))) return node.range[0];
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

function compareText(left: { sortText: string; index: number }, right: { sortText: string; index: number }): number {
    if (left.sortText.length !== right.sortText.length) return left.sortText.length - right.sortText.length;
    if (left.sortText !== right.sortText) return left.sortText < right.sortText ? -1 : 1;
    return left.index - right.index;
}

function compare(left: ImportLayoutEntry, right: ImportLayoutEntry): number {
    if (left.multiLine !== right.multiLine) return left.multiLine ? 1 : -1;
    if (left.multiLine && left.lineSpan !== right.lineSpan) return left.lineSpan - right.lineSpan;
    return compareText(left, right);
}

function entriesOf(source: TSESLint.SourceCode, run: TSESTree.Statement[]): ImportLayoutEntry[] {
    const text = source.getText();
    const starts = run.map((statement) => segmentStart(source, statement));
    const last = run.at(-1);
    const blockEnd = last === undefined ? 0 : segmentEnd(source, last);
    return run.map((statement, index) => {
        const start = starts[index] ?? statement.range[0];
        const end = starts[index + 1] ?? blockEnd;
        const statementText = source.getText(statement);
        return {
            node: statement,
            start,
            end,
            text: text.slice(start, end).trim(),
            sortText: statementText.replaceAll(SPACES, ' ').trim(),
            lineSpan: statement.loc.end.line - statement.loc.start.line + 1,
            multiLine: statementText.includes('\n'),
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
 * Consecutive statements the predicate accepts, as runs.
 * @param body the program statements
 * @param accepts whether a statement belongs to the block
 * @returns each uninterrupted run
 */
export function runsOf(
    body: TSESTree.Statement[],
    accepts: (statement: TSESTree.Statement) => boolean,
): TSESTree.Statement[][] {
    const runs: TSESTree.Statement[][] = [];
    let isOpen = false;
    for (const statement of body) {
        const isMember = accepts(statement);
        if (isMember && !isOpen) runs.push([]);
        if (isMember) runs.at(-1)?.push(statement);
        isOpen = isMember;
    }
    return runs;
}

/**
 * Report a run whose statements are not one-line first, then multi-line, each by length. The fix rewrites the run.
 * @param context the rule context
 * @param run the statements of one block
 */
export function reportRun(context: TSESLint.RuleContext<LayoutMessages, unknown[]>, run: TSESTree.Statement[]): void {
    const source = context.sourceCode;
    const entries = entriesOf(source, run);
    const [first] = entries;
    const last = entries.at(-1);
    if (first === undefined || last === undefined || entries.length <= 1) return;
    const expected = entries.toSorted(compare);
    const replacement = joined(expected);
    if (source.getText().slice(first.start, last.end).trim() === replacement) return;
    const misordered = entries.find((entry, index) => entry.node !== expected[index]?.node) ?? first;
    context.report({
        node: misordered.node,
        messageId: 'layout',
        fix: (fixer) => fixer.replaceTextRange([first.start, last.end], replacement),
    });
}

/**
 * Report names inside braces that are not sorted by length. The fix moves each name with the comments above it and
 * keeps the commas and line breaks where they are.
 * @param context the rule context
 * @param specifiers the named specifiers of one statement
 */
export function reportNames(
    context: TSESLint.RuleContext<LayoutMessages, unknown[]>,
    specifiers: (TSESTree.ImportSpecifier | TSESTree.ExportSpecifier)[],
): void {
    if (specifiers.length <= 1) return;
    const source = context.sourceCode;
    const text = source.getText();
    const names = specifiers.map((specifier, index) => {
        const start = segmentStart(source, specifier);
        return {
            node: specifier,
            start,
            end: specifier.range[1],
            text: text.slice(start, specifier.range[1]),
            sortText: source.getText(specifier).replaceAll(SPACES, ' ').trim(),
            index,
        };
    });
    const expected = names.toSorted(compareText);
    const misplaced = names.find((name, index) => name.node !== expected[index]?.node);
    if (misplaced === undefined) return;
    const [first] = names;
    const last = names.at(-1);
    if (first === undefined || last === undefined) return;
    const separators = names.slice(1).map((name, index) => text.slice(names[index]?.end ?? name.start, name.start));
    const replacement = expected
        .map((name, index) => `${index === 0 ? '' : (separators[index - 1] ?? '')}${name.text}`)
        .join('');
    context.report({
        node: misplaced.node,
        messageId: 'names',
        fix: (fixer) => fixer.replaceTextRange([first.start, last.end], replacement),
    });
}
