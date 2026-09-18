// Rule statements and their enforcement markers: which lines are statements, what marker each carries, and the counts.
import { EXAMPLE_LABELS, IMPERATIVE_OPENERS } from '#config/statements.ts';
import type { RuleFinding, Marker, MarkerCounts, Statement } from '#types/rules.ts';

const ENFORCED_PREFIX = '`enforced-by: ';

const UNENFORCED = '`unenforced`';

const FENCE = '```';

const FRONT_MATTER = '---';

const LIST_MARK = /^(?:[-*]|\d+\.)\s+/u;

function isFence(line: string): boolean {
    return line.trimStart().startsWith(FENCE);
}

function isListItem(line: string): boolean {
    const trimmed = line.trimStart();
    const isBullet =
        (trimmed.startsWith('- ') || trimmed.startsWith('* ')) &&
        !trimmed.startsWith('- [') &&
        !trimmed.startsWith('* [');
    const isNumbered = /^\d+\.\s+\S/u.test(trimmed);
    return (isBullet && trimmed.length > 2 && trimmed[2] !== ' ') || isNumbered;
}

function isListStart(line: string): boolean {
    const trimmed = line.trimStart();
    return trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/u.test(trimmed);
}

function isContinuation(line: string): boolean {
    return line.startsWith('  ') && line.trim() !== '' && !isListStart(line);
}

function isExampleLabel(trimmed: string): boolean {
    if (!trimmed.endsWith(':')) return false;
    const label = trimmed.slice(0, -1);
    return EXAMPLE_LABELS.includes(label) || label.startsWith('Good ') || label.startsWith('Bad ');
}

function isImperative(trimmed: string): boolean {
    return IMPERATIVE_OPENERS.some(
        (opener) =>
            trimmed === opener ||
            trimmed.startsWith(`${opener} `) ||
            trimmed.startsWith(`${opener},`) ||
            trimmed.startsWith(`${opener}.`),
    );
}

function isProseStart(line: string): boolean {
    const trimmed = line.trim();
    if (trimmed === '' || line.startsWith('  ')) return false;
    return !trimmed.startsWith('|') && !trimmed.startsWith('#') && !isExampleLabel(trimmed);
}

function isParagraphStatement(lines: string[], index: number): boolean {
    const line = lines[index] ?? '';
    const isAfterBlank = index === 0 || (lines[index - 1] ?? '').trim() === '';
    return isAfterBlank && isProseStart(line) && isImperative(line.trim());
}

function blockEnd(lines: string[], start: number): number {
    let end = start;
    while (end + 1 < lines.length && isContinuation(lines[end + 1] ?? '')) end += 1;
    return end;
}

function isIntroducer(lastLine: string): boolean {
    return withoutMarker(lastLine).trimEnd().endsWith(':');
}

function statementAt(lines: string[], start: number): Statement | undefined {
    const end = blockEnd(lines, start);
    const last = lines[end] ?? '';
    if (isIntroducer(last)) return undefined;
    const first = (lines[start] ?? '').trimStart().replace(LIST_MARK, '');
    const text = [first, ...lines.slice(start + 1, end + 1)]
        .map((line) => withoutMarker(line))
        .join(' ')
        .replaceAll(/\s+/gu, ' ')
        .trim();
    return { start, end, text, marker: parseMarker(last) };
}

function frontMatterEnd(lines: string[]): number {
    if (lines[0] !== FRONT_MATTER) return -1;
    return lines.indexOf(FRONT_MATTER, 1);
}

function statementInto(statements: Statement[], lines: string[], index: number): void {
    const statement = statementAt(lines, index);
    if (statement !== undefined) statements.push(statement);
}

function isCandidate(lines: string[], index: number): boolean {
    const line = lines[index] ?? '';
    return isListItem(line) || isParagraphStatement(lines, index);
}

function markerText(check: string | undefined): string {
    return check === undefined ? UNENFORCED : `${ENFORCED_PREFIX}${check}\``;
}

function introducersCleared(lines: string[], out: string[]): void {
    let isInFence = false;
    for (const [index, line] of lines.entries()) {
        if (isFence(line)) isInFence = !isInFence;
        else if (!isInFence && isIntroducer(line) && parseMarker(line) !== undefined) out[index] = withoutMarker(line);
    }
}

/**
 * The marker a line ends with, if any.
 * @param line the line
 * @returns the marker
 */
export function parseMarker(line: string): Marker | undefined {
    const trimmed = line.trimEnd();
    if (trimmed.endsWith(UNENFORCED)) return { kind: 'unenforced' };
    const start = trimmed.lastIndexOf(ENFORCED_PREFIX);
    if (start === -1 || !trimmed.endsWith('`')) return undefined;
    const inside = trimmed.slice(start + ENFORCED_PREFIX.length, -1).trim();
    return { kind: 'enforced', check: inside.split(' ', 1)[0] ?? '' };
}

/**
 * The line without its marker.
 * @param line the line
 * @returns the line, trailing marker removed
 */
export function withoutMarker(line: string): string {
    const trimmed = line.trimEnd();
    if (trimmed.endsWith(UNENFORCED)) return trimmed.slice(0, -UNENFORCED.length).trimEnd();
    const start = trimmed.lastIndexOf(ENFORCED_PREFIX);
    return start !== -1 && trimmed.endsWith('`') ? trimmed.slice(0, start).trimEnd() : line;
}

/**
 * Every rule statement in a file: a list item, or a paragraph that opens with an imperative; an item that ends with a colon introduces others and is none.
 * @param lines the file's lines
 * @returns the statements in order
 */
export function statementsOf(lines: string[]): Statement[] {
    const statements: Statement[] = [];
    let isInFence = false;
    let index = frontMatterEnd(lines) + 1;
    while (index < lines.length) {
        const isFenceLine = isFence(lines[index] ?? '');
        if (isFenceLine) isInFence = !isInFence;
        const isStatementStart = !isFenceLine && !isInFence && isCandidate(lines, index);
        if (isStatementStart) statementInto(statements, lines, index);
        index = (isStatementStart ? blockEnd(lines, index) : index) + 1;
    }
    return statements;
}

/**
 * How many statements a file holds and how many are unenforced (no marker counts as unenforced).
 * @param statements the file's statements
 * @returns the counts
 */
export function countMarkers(statements: Statement[]): MarkerCounts {
    const unenforced = statements.filter((statement) => statement.marker?.kind !== 'enforced').length;
    return { statements: statements.length, unenforced };
}

/**
 * Statements without a marker, and markers naming a check id the architecture does not.
 * @param path the file relative to rules/
 * @param statements the file's statements
 * @param checkIds the known check ids
 * @returns the findings
 */
export function markerFindings(path: string, statements: Statement[], checkIds: ReadonlySet<string>): RuleFinding[] {
    return statements.flatMap((statement) => {
        const line = statement.start + 1;
        if (statement.marker === undefined) return [{ file: path, line, message: 'statement without a marker' }];
        const { check } = statement.marker;
        if (check !== undefined && !checkIds.has(check))
            return [{ file: path, line, message: `unknown check id '${check}'` }];
        return [];
    });
}

/**
 * The file's lines with a marker on every statement: the check `checkFor` names, or `unenforced`. Introducer lines lose any marker.
 * @param lines the file's lines
 * @param checkFor the check that enforces a statement text, or undefined
 * @returns the new lines
 */
export function markedLines(lines: string[], checkFor: (text: string) => string | undefined): string[] {
    const out = [...lines];
    for (const statement of statementsOf(lines))
        out[statement.end] = `${withoutMarker(lines[statement.end] ?? '')} ${markerText(checkFor(statement.text))}`;
    introducersCleared(lines, out);
    return out;
}
