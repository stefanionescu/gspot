import type { Colors } from 'picocolors/types';
import { colors } from '#cli/output/messages.ts';
import { stripVTControlCharacters } from 'node:util';
import type { RunReport } from '#cli/execution/report.ts';
import { invokingHook } from '#cli/platform/environment.ts';
import type { CheckResult, Finding } from '#cli/checks/result.ts';

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

function statusWord(result: CheckResult, colors: Colors): string {
    const { red, green, yellow, dim } = colors;
    switch (result.status) {
        case 'ok': {
            return green('ok');
        }
        case 'cache': {
            return dim('unchanged');
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

function findingLines(finding: Finding, colors: Colors): string[] {
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

function failureLines(check: CheckResult, options: ReportOptions, colors: Colors): string[] {
    const shown = options.verbose ? check.findings : check.findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding) => findingLines(finding, colors));
    const hidden = check.findings.length - shown.length;
    if (hidden > 0) {
        const more = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${colors.dim(more)}`);
    }
    return lines;
}

function checkLines(check: CheckResult, columns: Columns, options: ReportOptions, colors: Colors): string[] {
    const scope = scopeName(check.scope).padEnd(columns.scope);
    const word = statusWord(check, colors);
    const status = word.padEnd(STATUS_WIDTH + word.length - stripVTControlCharacters(word).length);
    const lines = [`${scope}  ${check.check.padEnd(columns.check)}  ${status}  ${checkTail(check)}`.trimEnd()];
    if (options.verbose && check.command) {
        const command = `$ ${check.command.join(' ')}`;
        lines.push(`  ${colors.dim(command)}`);
    }
    if (check.status === 'fail') lines.push(...failureLines(check, options, colors));
    if (check.reproduce !== undefined) lines.push(`  ${colors.dim('reproduce:')} ${check.reproduce}`);
    return lines;
}

function ignoreLines(report: RunReport, options: ReportOptions, colors: Colors): string[] {
    if (report.ignores.length === 0) return [];
    if (!options.verbose) return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        const matched = `(${String(ignore.matched)} matched)`;
        return `ignore     ${ignore.check}${rule}${paths}  ${ignore.reason === undefined ? '' : colors.dim(ignore.reason)}  ${matched}`;
    });
}

function skipLine(check: string, source: string, colors: Colors): string {
    const shown = `(${source})`;
    return `skipped    ${check}  ${colors.dim(shown)}`;
}

function tailLines(report: RunReport, options: ReportOptions, colors: Colors): string[] {
    const lines = [
        ...ignoreLines(report, options, colors),
        ...report.skips.map((skip) => skipLine(skip.check, skip.source, colors)),
    ];
    if (report.coverage.unchecked > 0) lines.push(`unchecked  ${fileCount(report.coverage.unchecked)} (gspot doctor)`);
    for (const finding of report.coverage.findings) lines.push(...findingLines(finding, colors));
    if (report.unstaged > 0) {
        const verb = report.unstaged === 1 ? ' has' : 's have';
        lines.push(
            `checked ${report.comparison?.content === 'index' ? 'index' : 'working tree'}; ${String(report.unstaged)} file${verb} unstaged changes`,
        );
    }
    return lines;
}

function summaryLine(report: RunReport, colors: Colors): string {
    const passed = report.checks.filter((check) => check.status === 'ok' || check.status === 'cache').length;
    const failed = report.checks.filter((check) => ['fail', 'missing', 'error'].includes(check.status)).length;
    const skipped = report.checks.filter((check) => check.status === 'skipped').length;
    const findings = report.checks.reduce(
        (count, check) => count + check.findings.length,
        report.coverage.findings.length,
    );
    const count = (value: number, noun: string): string => `${String(value)} ${noun}${value === 1 ? '' : 's'}`;
    const summary = `${count(passed, 'check')} passed, ${count(failed, 'check')} failed, ${count(skipped, 'check')} skipped, ${count(findings, 'finding')}, ${seconds(report.duration)}`;
    if (report.exitCode === 2) return colors.red(`${summary} (incomplete)`);
    return report.exitCode === 0 ? summary : colors.red(`${summary} (failed)`);
}

/**
 * The run as text, the way 02-cli.md shows it.
 * @param report the run report
 * @param options quiet and verbose output flags
 * @returns the text for stdout
 */
export function runText(report: RunReport, options: ReportOptions): string {
    const shown = report.checks.filter((check) => !QUIET_HIDES.has(check.status));
    const columns: Columns = {
        scope: Math.max(SCOPE_WIDTH_MIN, ...report.checks.map((check) => scopeName(check.scope).length)),
        check: Math.max(ID_WIDTH_MIN, ...report.checks.map((check) => check.check.length)),
    };
    const body = shown.flatMap((check) => checkLines(check, columns, options, colors));
    const tail = tailLines(report, options, colors);
    const isSeparated = tail.length > 0 && body.length > 0;
    const lines = [...body, ...(isSeparated ? [''] : []), ...tail];
    if (lines.length > 0) lines.push('');
    lines.push(summaryLine(report, colors));
    const hook = invokingHook();
    if (hook !== undefined && report.exitCode !== 0) {
        const reproduce = report.checks.find((check) => check.reproduce !== undefined)?.reproduce;
        if (reproduce !== undefined) lines.push(`reproduce: ${reproduce}`);
        lines.push(`Bypass this hook once: git ${hook === 'pre-push' ? 'push' : 'commit'} --no-verify`);
    }
    const comparison =
        report.comparison === undefined || options.quiet
            ? ''
            : report.comparison.content === 'working-tree'
              ? `Working tree compared with the merge base of ${report.comparison.reference}.\n`
              : `${report.comparison.content === 'index' ? 'Staged index' : 'Committed tree'} ${report.comparison.reference}.\n`;
    return `${comparison}${lines.join('\n')}\n`;
}

type Columns = { scope: number; check: number };

type ReportOptions = { quiet: boolean; verbose: boolean };
