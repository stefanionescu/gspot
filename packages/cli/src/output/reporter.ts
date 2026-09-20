// Check lines, findings, help lines, reproduce lines, the summary; columns from the longest id.
import { paint } from '#cli/output/messages.ts';
import type { RunRecord } from '#types/record.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { Columns, Painter, ReportOptions } from '#types/output.ts';

const MS_PER_SECOND = 1000;
const SCOPE_WIDTH_MIN = 4;
const ID_WIDTH_MIN = 8;
const STATUS_WIDTH = 9;
const FILES_WIDTH = 11;
const FINDINGS_SHOWN = 200;
const NOTE_STATUSES = new Set(['missing', 'error', 'skipped']);
const QUIET_HIDES = new Set(['ok', 'cache']);

function seconds(ms: number): string {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
}

function fileCount(count: number): string {
    return `${String(count)} file${count === 1 ? '' : 's'}`;
}

function scopeName(scope: string): string {
    return scope === '' ? 'root' : scope;
}

function statusWord(result: CheckResult, colors: Painter): string {
    const { red, green, yellow, dim } = colors;
    switch (result.status) {
        case 'ok': {
            return green('ok');
        }
        case 'cache': {
            return dim('cache');
        }
        case 'fail': {
            return red('fail');
        }
        case 'missing': {
            return red('missing');
        }
        case 'error': {
            return red('error');
        }
        case 'skipped': {
            return yellow('skip');
        }
    }
}

function location(finding: Finding): string {
    if (finding.file === '') return '';
    const line = finding.line === undefined ? '' : `:${String(finding.line)}`;
    const column = finding.column === undefined ? '' : `:${String(finding.column)}`;
    return `${finding.file}${line}${column}  `;
}

function findingLines(finding: Finding, colors: Painter): string[] {
    const { dim, cyan } = colors;
    const rule = cyan(finding.rule ?? finding.check);
    const lines = [`  ${location(finding)}${rule}  ${finding.message}`];
    if (finding.help !== undefined && finding.help !== '') lines.push(`    ${dim('help:')} ${finding.help}`);
    return lines;
}

function checkTail(check: CheckResult): string {
    if (NOTE_STATUSES.has(check.status)) return check.note ?? '';
    const time = check.status === 'cache' ? '' : seconds(check.duration);
    return `${fileCount(check.files).padEnd(FILES_WIDTH)} ${time}`;
}

function failureLines(check: CheckResult, options: ReportOptions, colors: Painter): string[] {
    const shown = options.verbose ? check.findings : check.findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding) => findingLines(finding, colors));
    const hidden = check.findings.length - shown.length;
    if (hidden > 0) {
        const more = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${colors.dim(more)}`);
    }
    return lines;
}

function checkLines(check: CheckResult, columns: Columns, options: ReportOptions, colors: Painter): string[] {
    const scope = scopeName(check.scope).padEnd(columns.scope);
    const status = statusWord(check, colors).padEnd(STATUS_WIDTH);
    const lines = [`${scope}  ${check.id.padEnd(columns.id)}  ${status}  ${checkTail(check)}`.trimEnd()];
    if (options.verbose && check.command) {
        const command = `$ ${check.command.join(' ')}`;
        lines.push(`  ${colors.dim(command)}`);
    }
    if (check.status === 'fail') lines.push(...failureLines(check, options, colors));
    if (check.reproduce !== undefined) lines.push(`  ${colors.dim('reproduce:')} ${check.reproduce}`);
    return lines;
}

function baselineLines(record: RunRecord, colors: Painter): string[] {
    const exceeded = record.baselines.filter((verdict) => !verdict.held);
    const held = record.baselines.filter((verdict) => verdict.held);
    const count = (verdict: RunRecord['baselines'][number]): string =>
        `${verdict.check}:${verdict.rule}  ${String(verdict.count)} of ${String(verdict.baseline)}`;
    return [
        ...exceeded.map((verdict) => `${colors.red('baseline exceeded')}  ${count(verdict)}`),
        ...held.map((verdict) => `baselines  ${count(verdict)}`),
    ];
}

function ignoreLines(record: RunRecord, options: ReportOptions, colors: Painter): string[] {
    if (record.ignores.length === 0) return [];
    if (!options.verbose) return [`ignores    ${String(record.ignores.length)} (printed with --verbose)`];
    return record.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        const matched = `(${String(ignore.matched)} matched)`;
        return `ignore     ${ignore.check}${rule}${paths}  ${colors.dim(ignore.reason)}  ${matched}`;
    });
}

function skipLine(check: string, source: string, colors: Painter): string {
    const shown = `(${source})`;
    return `skipped    ${check}  ${colors.dim(shown)}`;
}

function tailLines(record: RunRecord, options: ReportOptions, colors: Painter): string[] {
    const lines = [
        ...baselineLines(record, colors),
        ...ignoreLines(record, options, colors),
        ...record.skips.map((skip) => skipLine(skip.check, skip.source, colors)),
    ];
    if (record.inspection.unchecked > 0)
        lines.push(`unchecked  ${fileCount(record.inspection.unchecked)} (gspot doctor)`);
    if (record.unstaged > 0) {
        const verb = record.unstaged === 1 ? ' has' : 's have';
        lines.push(`checked working tree; ${String(record.unstaged)} file${verb} unstaged changes`);
    }
    return lines;
}

function summaryLine(record: RunRecord, options: ReportOptions, shownCount: number, colors: Painter): string {
    if (record.failed.length > 0) return colors.red(`failed: ${record.failed.join(', ')}`);
    if (shownCount === 0 && options.quiet) return 'passed';
    const count = record.checks.length;
    return `passed: ${String(count)} check${count === 1 ? '' : 's'}`;
}

/**
 * The run as text, the way 02-cli.md shows it.
 * @param record the run record
 * @param options quiet and verbose output flags
 * @returns the text for stdout
 */
export function runText(record: RunRecord, options: ReportOptions): string {
    const colors = paint();
    const isHidden = (check: CheckResult): boolean => options.quiet && QUIET_HIDES.has(check.status);
    const shown = record.checks.filter((check) => !isHidden(check));
    const columns: Columns = {
        scope: Math.max(SCOPE_WIDTH_MIN, ...record.checks.map((check) => scopeName(check.scope).length)),
        id: Math.max(ID_WIDTH_MIN, ...record.checks.map((check) => check.id.length)),
    };
    const body = shown.flatMap((check) => checkLines(check, columns, options, colors));
    const tail = tailLines(record, options, colors);
    const isSeparated = tail.length > 0 && body.length > 0;
    const lines = [...body, ...(isSeparated ? [''] : []), ...tail];
    if (lines.length > 0) lines.push('');
    lines.push(summaryLine(record, options, shown.length, colors));
    return `${lines.join('\n')}\n`;
}
