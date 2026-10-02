import type { Colors } from 'picocolors/types';
import { colors } from '#cli/output/messages.ts';
import { stripVTControlCharacters } from 'node:util';
import { HOOK_FILES } from '#cli/config/generation/generation.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { Columns, ReporterOptions } from '#cli/types/output.ts';
import { ERROR_EXIT, MS_PER_SECOND } from '#cli/config/platform/platform.ts';
import type { Finding, RunReport, CheckResult } from '#cli/types/execution/execution.ts';

import {
    FILES_WIDTH,
    QUIET_HIDES,
    ID_WIDTH_MIN,
    STATUS_WIDTH,
    NOTE_STATUSES,
    FINDINGS_SHOWN,
    SCOPE_WIDTH_MIN,
} from '#cli/config/output.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two lines print a duration; inlining it nests a template inside a template.
function seconds(ms: number): string {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two lines count files; inlining it nests a template inside a template.
function fileCount(count: number): string {
    return `${String(count)} file${count === 1 ? '' : 's'}`;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two readers name the root scope; the caller sits at the complexity limit.
function scopeName(scope: string): string {
    return scope === '' ? 'root' : scope;
}

function statusWord(result: CheckResult, colors: Colors): string {
    const { red, green, yellow } = colors;
    switch (result.status) {
        case 'ok': {
            return green('ok');
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

// The lines of one finding. Its help follows unless the next finding shares it, so a run of findings with the same
// help prints it once, after the last of them.
function findingLines(finding: Finding, colors: Colors, next?: Finding): string[] {
    const { dim, cyan } = colors;
    const rule = cyan(finding.rule ?? finding.check);
    const lines = [`  ${location(finding)}${rule}  ${finding.message}`];
    if (finding.help !== undefined && finding.help !== '' && next?.help !== finding.help)
        lines.push(`    ${dim('help:')} ${finding.help}`);
    return lines;
}

function checkTail(check: CheckResult): string {
    if (NOTE_STATUSES.has(check.status)) return check.note ?? '';
    return `${fileCount(check.files).padEnd(FILES_WIDTH)} ${seconds(check.duration)}`;
}

function failureLines(check: CheckResult, options: ReporterOptions, colors: Colors): string[] {
    const shown = options.verbose ? check.findings : check.findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding, index) => findingLines(finding, colors, shown[index + 1]));
    const hidden = check.findings.length - shown.length;
    if (hidden > 0) {
        const more = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${colors.dim(more)}`);
    }
    return lines;
}

function checkLines(check: CheckResult, columns: Columns, options: ReporterOptions, colors: Colors): string[] {
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

function ignoreLines(report: RunReport, options: ReporterOptions, colors: Colors): string[] {
    if (report.ignores.length === 0) return [];
    if (!options.verbose) return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        const matched = `(${String(ignore.matched)} matched)`;
        return `ignore     ${ignore.check}${rule}${paths}  ${ignore.reason === undefined ? '' : colors.dim(ignore.reason)}  ${matched}`;
    });
}

function tailLines(report: RunReport, options: ReporterOptions, colors: Colors): string[] {
    const lines = [
        ...ignoreLines(report, options, colors),
        ...report.skips.map((skip) => {
            const source = colors.dim(`(${skip.source})`);
            return `skipped    ${skip.check}  ${source}`;
        }),
    ];
    if (report.unstaged > 0) {
        const verb = report.unstaged === 1 ? ' has' : 's have';
        lines.push(
            `checked ${report.comparison?.content === 'index' ? 'index' : 'working tree'}; ${String(report.unstaged)} file${verb} unstaged changes`,
        );
    }
    return lines;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four summary lines count a noun; inlining it nests a template inside a template.
function counted(value: number, noun: string): string {
    return `${String(value)} ${noun}${value === 1 ? '' : 's'}`;
}

function summaryLine(report: RunReport, colors: Colors): string {
    const passed = report.checks.filter((check) => check.status === 'ok').length;
    const failed = report.checks.filter((check) => ['fail', 'missing', 'error'].includes(check.status)).length;
    const skipped = report.checks.filter((check) => check.status === 'skipped').length;
    const findings = report.checks.reduce((count, check) => count + check.findings.length, 0);
    const summary = `${counted(passed, 'check')} passed, ${counted(failed, 'check')} failed, ${counted(skipped, 'check')} skipped, ${counted(findings, 'finding')}, ${seconds(report.duration)}`;
    if (report.exitCode === ERROR_EXIT) return colors.red(`${summary} (incomplete)`);
    return report.exitCode === 0 ? summary : colors.red(`${summary} (failed)`);
}

function hookFailureLines(report: RunReport): string[] {
    const hook = HOOK_FILES.find((name) => name === environmentVariables()['GSPOT_HOOK']);
    if (hook === undefined || report.exitCode === 0) return [];
    const lines: string[] = [];
    const reproduce = report.checks.find((check) => check.reproduce !== undefined)?.reproduce;
    if (reproduce !== undefined) lines.push(`reproduce: ${reproduce}`);
    lines.push(`Bypass this hook once: git ${hook === 'pre-push' ? 'push' : 'commit'} --no-verify`);
    return lines;
}

function comparisonLine(comparison: RunReport['comparison'], quiet: boolean): string {
    if (comparison === undefined || quiet) return '';
    if (comparison.content === 'working-tree')
        return `Working tree compared with the merge base of ${comparison.reference}.\n`;
    const source = comparison.content === 'index' ? 'Staged index' : 'Committed tree';
    return `${source} ${comparison.reference}.\n`;
}

/**
 * The run as text: one line per check, its findings, the ignores and skips, and the summary.
 * @param report the run report
 * @param options quiet and verbose output flags
 * @returns the text for stdout
 */
export function runText(report: RunReport, options: ReporterOptions): string {
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
    lines.push(summaryLine(report, colors), ...hookFailureLines(report));
    return `${comparisonLine(report.comparison, options.quiet)}${lines.join('\n')}\n`;
}

/**
 * Print completed check states without mixing progress into machine-readable output.
 * @param stream the stream progress goes to
 * @param stream.isTTY whether a person is watching it
 * @param stream.write writes one line
 * @param quiet whether progress stays off
 * @returns the function each completed check is handed to
 */
export function progress(
    stream: { isTTY?: boolean; write(text: string): unknown },
    quiet: boolean,
): (result: CheckResult) => void {
    return (result) => {
        const failed = ['fail', 'missing', 'error'].includes(result.status);
        if (!failed && (quiet || stream.isTTY !== true)) return;
        stream.write(`${result.scope === '' ? 'root' : result.scope}  ${result.check}  ${result.status}\n`);
    };
}
