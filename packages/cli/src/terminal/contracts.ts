import { colors } from '#cli/terminal/public.ts';
import { stripVTControlCharacters } from 'node:util';
import type { Finding } from '#cli/types/parsers/output.ts';
import { FAILED_STATUSES } from '#cli/config/execution/runtime.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/check.ts';
import { EXIT_ERROR, MS_PER_SECOND } from '#cli/config/platform/runtime.ts';
import type { Columns, OutputOptions, ProgressStream } from '#cli/types/terminal.ts';

import {
    FILES_WIDTH,
    ID_WIDTH_MIN,
    STATUS_WIDTH,
    NOTE_STATUSES,
    FINDINGS_SHOWN,
    SCOPE_WIDTH_MIN,
    CHECK_STATUS_COLORS,
    COMMIT_PREFIX_LENGTH,
} from '#cli/config/terminal.ts';

function seconds(milliseconds: number): string {
    return `${(milliseconds / MS_PER_SECOND).toFixed(1)}s`;
}

function location(finding: Finding): string {
    if (finding.file === '') return '';
    const line = finding.line === undefined ? '' : `:${String(finding.line)}`;
    const column = finding.column === undefined ? '' : `:${String(finding.column)}`;
    return `${finding.file}${line}${column}  `;
}

// The lines of one finding. Its help follows unless the next finding shares it, so a run of findings with the same
// help prints it once, after the last of them.
function findingLines(finding: Finding, next?: Finding): string[] {
    const { dim, cyan } = colors;
    const rule = cyan(finding.rule ?? finding.check);
    const lines = [`  ${location(finding)}${rule}  ${finding.message}`];
    if (finding.help !== undefined && finding.help !== '' && next?.help !== finding.help)
        lines.push(`    ${dim('help:')} ${finding.help}`);
    return lines;
}

function checkTail(check: CheckResult): string {
    if (NOTE_STATUSES.has(check.status)) return check.note ?? '';
    return `${counted(check.fileCount, 'file').padEnd(FILES_WIDTH)} ${seconds(check.duration)}`;
}

function failureLines(check: CheckResult, verbosity: OutputOptions['verbosity']): string[] {
    const shown = verbosity === 'verbose' ? check.findings : check.findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding, index) => findingLines(finding, shown[index + 1]));
    const hidden = check.findings.length - shown.length;
    if (hidden > 0) {
        const more = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${colors.dim(more)}`);
    }
    return lines;
}

function checkLines(check: CheckResult, columns: Columns, verbosity: OutputOptions['verbosity']): string[] {
    const scope = (check.scope === '' ? 'root' : check.scope).padEnd(columns.scope);
    const word = colors[CHECK_STATUS_COLORS[check.status]](check.status);
    const status = word.padEnd(STATUS_WIDTH + word.length - stripVTControlCharacters(word).length);
    const lines = [`${scope}  ${check.check.padEnd(columns.check)}  ${status}  ${checkTail(check)}`.trimEnd()];
    if (verbosity === 'verbose' && check.command) {
        const command = `$ ${check.command.join(' ')}`;
        lines.push(`  ${colors.dim(command)}`);
    }
    if (check.status === 'failed') lines.push(...failureLines(check, verbosity));
    if (check.reproduce !== undefined) lines.push(`  ${colors.dim('reproduce:')} ${check.reproduce}`);
    return lines;
}

function ignoreLines(report: RunReport, verbosity: OutputOptions['verbosity']): string[] {
    if (report.ignores.length === 0) return [];
    if (verbosity !== 'verbose') return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        const matched = `(${String(ignore.matched)} matched)`;
        return `ignore     ${ignore.check}${rule}${paths}  ${ignore.reason === undefined ? '' : colors.dim(ignore.reason)}  ${matched}`;
    });
}

function tailLines(report: RunReport, verbosity: OutputOptions['verbosity']): string[] {
    const lines = [
        ...ignoreLines(report, verbosity),
        ...(verbosity === 'quiet' ? [] : report.skips).map((skip) => {
            const cause = colors.dim(`(${skip.cause})`);
            return `skipped    ${skip.check}  ${cause}`;
        }),
    ];
    if (report.unstagedChanges > 0) {
        const verb = report.unstagedChanges === 1 ? ' has' : 's have';
        lines.push(
            `Checked the ${report.comparison?.content === 'index' ? 'staged files' : 'working tree'}. ${String(report.unstagedChanges)} file${verb} unstaged changes that were not checked.`,
        );
    }
    return lines;
}

function counted(value: number, noun: string): string {
    return `${String(value)} ${noun}${value === 1 ? '' : 's'}`;
}

function summaryLine(report: RunReport): string {
    const passed = report.checks.filter((check) => check.status === 'passed').length;
    const failed = report.checks.filter((check) => FAILED_STATUSES.has(check.status)).length;
    const skipped = report.checks.filter((check) => check.status === 'skipped').length;
    const findings = report.checks.reduce((count, check) => count + check.findings.length, 0);
    const summary = `${counted(passed, 'check')} passed, ${counted(failed, 'check')} failed, ${counted(skipped, 'check')} skipped, ${counted(findings, 'finding')}, ${seconds(report.duration)}`;
    if (report.exitCode === EXIT_ERROR) return colors.red(`${summary} (incomplete)`);
    return report.exitCode === 0 ? summary : colors.red(`${summary} (failed)`);
}

function comparisonLine(comparison: RunReport['comparison'], verbosity: OutputOptions['verbosity']): string {
    if (comparison === undefined || verbosity === 'quiet') return '';
    if (comparison.content === 'working-tree')
        return `Working tree compared with the merge base of ${comparison.reference}.\n`;
    if (comparison.content === 'index') return 'Checked the staged files.\n';
    return `Checked commit ${comparison.reference.slice(0, COMMIT_PREFIX_LENGTH)}.\n`;
}

/**
 * The run as text: one line per check, its findings, the ignores and skips, and the summary.
 * @param report the run report
 * @param verbosity the selected output detail
 * @param hook the hook whose failure needs a bypass instruction
 * @returns the text for stdout
 */
export function runText(
    report: RunReport,
    verbosity: OutputOptions['verbosity'],
    hook?: 'pre-commit' | 'pre-push' | 'commit-msg',
): string {
    const shown =
        verbosity === 'quiet' ? report.checks.filter((check) => FAILED_STATUSES.has(check.status)) : report.checks;
    const columns: Columns = {
        scope: Math.max(
            SCOPE_WIDTH_MIN,
            ...report.checks.map((check) => (check.scope === '' ? 'root' : check.scope).length),
        ),
        check: Math.max(ID_WIDTH_MIN, ...report.checks.map((check) => check.check.length)),
    };
    const body = shown.flatMap((check) => checkLines(check, columns, verbosity));
    const tail = tailLines(report, verbosity);
    const isSeparated = tail.length > 0 && body.length > 0;
    const lines = [...body, ...(isSeparated ? [''] : []), ...tail];
    if (lines.length > 0) lines.push('');
    lines.push(summaryLine(report));
    if (hook !== undefined && report.exitCode !== 0)
        lines.push(`Bypass this hook once: git ${hook === 'pre-push' ? 'push' : 'commit'} --no-verify`);
    return `${comparisonLine(report.comparison, verbosity)}${lines.join('\n')}\n`;
}

/**
 * Print completed check states without mixing progress into machine-readable output.
 * @param stream the stream progress goes to
 * @param stream.isTTY whether a person is watching it
 * @param stream.write writes one line
 * @param verbosity the selected output detail
 * @returns the function each completed check is handed to
 */
export function progress(stream: ProgressStream, verbosity: OutputOptions['verbosity']): (result: CheckResult) => void {
    return (result) => {
        const failed = FAILED_STATUSES.has(result.status);
        if (!failed && (verbosity === 'quiet' || stream.isTTY !== true)) return;
        stream.write(`${result.scope === '' ? 'root' : result.scope}  ${result.check}  ${result.status}\n`);
    };
}
