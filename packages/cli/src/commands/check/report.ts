// Format check findings, fixes, progress, and the final run summary.
import { formatCount } from '#cli/system/text.ts';
import { stripVTControlCharacters } from 'node:util';
import { warn, getColors } from '#cli/system/terminal.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { Finding, RunReport, FixReport, CheckResult, CheckProgress } from '#cli/types/runs/check.ts';

import {
    NOTE_STATUSES,
    FINDINGS_SHOWN,
    PROGRESS_CLEAR,
    CHECK_STATUS_COLORS,
    FIXER_ERROR_MESSAGE,
    COMMIT_PREFIX_LENGTH,
} from '#cli/config/terminal.ts';

function formatFixerFailure(note: string): string {
    return (
        note
            .split('\n')
            .find((line) => FIXER_ERROR_MESSAGE.test(line))
            ?.replace(FIXER_ERROR_MESSAGE, '') ?? note.split('\n').slice(0, 1).join('')
    );
}

function printFailedFixers(fixes: FixReport, verbose: boolean): void {
    for (const result of fixes.results) {
        if (result.status !== 'failed') continue;
        const note = stripVTControlCharacters(result.note);
        const detail = formatFixerFailure(note);
        warn(
            `The ${result.check} fixer failed: ${detail.endsWith('.') ? detail.slice(0, -1) : detail}. Run gspot check --only ${result.check} --fix --verbose.`,
        );
        if (verbose)
            process.stderr.write(
                note
                    .split('\n')
                    .map((line) => '  ' + line)
                    .join('\n') + '\n',
            );
    }
}

function formatProgressSubject(comparison: CheckProgress['comparison']): string {
    if (comparison?.content === 'index') return 'the staged files';
    if (comparison?.content === 'commit') return `commit ${comparison.reference.slice(0, COMMIT_PREFIX_LENGTH)}`;
    return 'the working tree';
}

function formatUnstagedChanges(report: RunReport): string[] {
    if (report.unstagedChanges === 0) return [];
    const verb = report.unstagedChanges === 1 ? 'has' : 'have';
    const subject = report.comparison?.content === 'index' ? 'staged files' : 'working tree';
    return [
        `Checked the ${subject}. ${formatCount(report.unstagedChanges, 'file')} ${verb} unstaged changes that were not checked.`,
    ];
}

function formatSeconds(milliseconds: number): string {
    return `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
}

function formatLocation(finding: Finding): string {
    if (finding.file === '') return '';
    const line = finding.line === undefined ? '' : `:${String(finding.line)}`;
    const column = finding.column === undefined ? '' : `:${String(finding.column)}`;
    return `${finding.file}${line}${column}  `;
}

// Shared help follows the last finding that needs it.
function formatFinding(finding: Finding, next?: Finding): string[] {
    const rule =
        finding.rule === undefined || finding.rule === finding.check ? '' : `${getColors().cyan(finding.rule)}  `;
    const lines = [`  ${formatLocation(finding)}${rule}${finding.message}`];
    if (finding.help !== undefined && finding.help !== '' && next?.help !== finding.help)
        lines.push(`  ${getColors().dim('help:')} ${finding.help}`);
    return lines;
}

function formatCheckTail(check: CheckResult): string {
    if (NOTE_STATUSES.has(check.status)) return check.note ?? '';
    if (check.status === 'failed') return formatCount(check.findings.length, 'finding');
    return `${formatCount(check.fileCount, 'file')}  ${formatSeconds(check.duration)}`;
}

function formatCheckFindings(findings: readonly Finding[], verbose: boolean): string[] {
    const shown = verbose ? findings : findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding, index) => formatFinding(finding, shown[index + 1]));
    const hidden = findings.length - shown.length;
    if (hidden > 0) {
        const message = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${getColors().dim(message)}`);
    }
    return lines;
}

function formatCheck(check: CheckResult, { verbose }: { verbose: boolean }): string[] {
    const status = getColors()[CHECK_STATUS_COLORS[check.status]](check.status);
    const scope = check.scope === '' ? '' : `${check.scope}  `;
    const tail = formatCheckTail(check);
    const lines = [`${scope}${check.check}  ${status}  ${tail}`.trimEnd()];
    if (verbose && check.command) lines.push(`  ${getColors().dim('$ ' + check.command.join(' '))}`);
    if (check.status === 'failed') lines.push(...formatCheckFindings(check.findings, verbose));
    if ((check.status === 'failed' || check.status === 'error') && check.reproduce !== undefined)
        lines.push(`  ${getColors().dim('run again:')} ${check.reproduce}`);
    return lines;
}

function formatIgnores(report: RunReport, { verbose }: { verbose: boolean }): string[] {
    if (report.ignores.length === 0) return [];
    if (!verbose) return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        return `ignore     ${ignore.check ?? 'every check'}${rule}${paths}  ${ignore.reason === undefined ? '' : getColors().dim(ignore.reason)}  (${String(ignore.matched)} matched)`;
    });
}

function formatSummary(report: RunReport): string {
    const failed = report.checks.filter((check) => check.status === 'failed');
    const missing = report.checks.filter((check) => check.status === 'missing').length;
    const errors = report.checks.filter((check) => check.status === 'error').length;
    const passed = report.checks.filter((check) => check.status === 'passed').length;
    const skipped = report.checks.filter((check) => check.status === 'skipped').length;
    const findings = failed.reduce((count, check) => count + check.findings.length, 0);
    const parts = [];
    if (failed.length > 0)
        parts.push(`Failed: ${formatCount(failed.length, 'check')} with ${formatCount(findings, 'finding')}.`);
    if (missing + errors > 0)
        parts.push(
            `Could not run: ${formatCount(missing + errors, 'check')}${missing > 0 ? ' (a tool is missing; run gspot install)' : ''}.`,
        );
    parts.push(`Passed: ${formatCount(passed, 'check')}.`, `Skipped: ${formatCount(skipped, 'check')}.`);
    const text = parts.join(' ');
    return report.exitCode === 0 ? text : getColors().red(text);
}

function formatComparison(comparison: RunReport['comparison']): string {
    if (comparison === undefined) return '';
    if (comparison.content === 'working-tree') return `Checked the files changed since ${comparison.reference}.\n`;
    if (comparison.content === 'index') return 'Checked the staged files.\n';
    return `Checked commit ${comparison.reference.slice(0, COMMIT_PREFIX_LENGTH)}.\n`;
}

/**
 * Format the report and its summary from one result list.
 * @param report the check results and totals.
 * @param options how to show the report.
 * @param options.verbose whether to show passing checks and full tool output.
 * @param options.hook pre-commit, pre-push, or commit-msg, when Git started the run.
 * @returns the check lines and the summary.
 */
export function formatRunReport(
    report: RunReport,
    options: { verbose: boolean; hook?: (typeof CHECK_HOOKS)[number] },
): string {
    const { verbose, hook } = options;
    const checks = report.checks.filter(
        (check) => verbose || (check.status !== 'passed' && check.status !== 'skipped'),
    );
    const lines = checks.flatMap((check) => [...formatCheck(check, { verbose }), '']);
    lines.push(
        ...formatIgnores(report, { verbose }),
        ...formatUnstagedChanges(report),
        formatSummary(report),
        `Time: ${formatSeconds(report.duration)}. Exit code ${String(report.exitCode)}.`,
    );
    if (hook !== undefined && report.exitCode !== 0)
        lines.push(`Bypass this hook once: git ${hook === 'pre-push' ? 'push' : 'commit'} --no-verify`);
    return `${formatComparison(report.comparison)}${lines.join('\n')}\n`;
}

/**
 * Print one terminal status line, or clear it before the report prints.
 * @param progress the last finished check and its place in the run.
 */
export function printProgress(progress: CheckProgress | undefined): void {
    if (!process.stderr.isTTY) return;
    if (progress === undefined) {
        process.stderr.write(PROGRESS_CLEAR);
        return;
    }
    const subject = formatProgressSubject(progress.comparison);
    process.stderr.write(
        `${PROGRESS_CLEAR}Checking ${subject}: ${String(progress.completed)} of ${String(progress.total)} checks done`,
    );
}

/**
 * Describe the fixes, and keep tool output and passing fixes out of the warnings.
 * @param fixes the fixer results and the verification state.
 * @param options how to show the fixes.
 * @param options.isDryRun whether the run shows fixes and writes nothing.
 * @param options.verbose whether to show passing checks and full tool output.
 * @returns the lines that describe the fixes.
 */
export function formatFixes(fixes: FixReport, options: { isDryRun: boolean; verbose: boolean }): string[] {
    const { isDryRun, verbose } = options;
    printFailedFixers(fixes, verbose);
    const count = fixes.changed.length;
    if (isDryRun)
        return [
            ...fixes.diffs,
            count === 0 ? 'No fixer changes anything.' : `${formatCount(count, 'file')} would change.`,
            '',
        ];
    if (count === 0) return ['No fixer changed anything.'];
    return [
        `fixed ${formatCount(count, 'file')}: ${fixes.changed.join(', ')}. The changes are not staged.`,
        ...fixes.broken.map(
            (path) =>
                `The fixers left a syntax error in ${path}. Restore it with git checkout -- ${path}, then fix it by hand.`,
        ),
    ];
}
