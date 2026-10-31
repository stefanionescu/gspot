import { CODE_MARK } from '#cli/config/main.ts';
import { LINE_BREAK } from '#cli/config/text.ts';
import { EVERY_CHECK } from '#cli/config/ignores.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { formatCount, quoteArgument } from '#cli/system/text.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import { getColors, stripControlCharacters } from '#cli/system/terminal.ts';
import { type FixReport, type RunReport, type CheckProgress } from '#cli/types/commands/check.ts';

import {
    RUN_AGAIN,
    STAGED_FILES,
    WORKING_TREE,
    NOTE_STATUSES,
    PROGRESS_CLEAR,
    FINDINGS_SHOWN,
    SHORT_HASH_LENGTH,
    FIXER_ERROR_PREFIX,
    CHECK_STATUS_COLORS,
    TOOL_MISSING_MESSAGE,
    STANDARD_INSTALL_HELP,
    UNCHANGED_FIX_MESSAGE,
} from '#cli/config/commands/check.ts';

function formatCheckedContent(comparison: CheckProgress['comparison']): string {
    if (comparison?.content === 'index') return STAGED_FILES;
    return comparison?.content === 'commit'
        ? `commit ${comparison.reference.slice(0, SHORT_HASH_LENGTH)}`
        : WORKING_TREE;
}

function formatUnstagedChanges(report: RunReport): string[] {
    if (report.unstagedChanges === 0) return [];
    const verb = report.unstagedChanges === 1 ? 'has' : 'have';
    return [`${formatCount(report.unstagedChanges, 'file')} ${verb} unstaged changes that were not checked.`];
}

function formatLocation(finding: Finding): string {
    if (finding.file === '') return '';
    const line = finding.line === undefined ? '' : `:${String(finding.line)}`;
    const column = finding.column === undefined ? '' : `:${String(finding.column)}`;
    return `${finding.file}${line}${column}  `;
}

function formatFinding(finding: Finding, next?: Finding): string[] {
    const rule =
        finding.rule === undefined || finding.rule === finding.check ? '' : `${getColors().cyan(finding.rule)}  `;
    const lines = [
        `  ${formatLocation(finding)}${rule}${finding.message
            .split(LINE_BREAK)
            .map((line) => line.trim())
            .join(' ')}`,
    ];
    if (finding.help !== undefined && finding.help !== '' && next?.help !== finding.help)
        lines.push(`  ${getColors().dim('help:')} ${finding.help.replaceAll(CODE_MARK, '')}`);
    return lines;
}

function formatCheckTail(result: CheckResult): string {
    if (NOTE_STATUSES.has(result.status)) return result.note ?? '';
    return result.status === 'failed'
        ? formatCount(result.findings.length, 'finding')
        : `${formatCount(result.fileCount, 'file')}  ${(result.duration / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
}

function formatFindings(findings: readonly Finding[], { verbose }: { verbose: boolean }): string[] {
    const shown = verbose ? findings : findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding, index) => formatFinding(finding, shown[index + 1]));
    const hidden = findings.length - shown.length;
    if (hidden > 0) {
        const message = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${getColors().dim(message)}`);
    }
    return lines;
}

function formatCheck(result: CheckResult, { verbose }: { verbose: boolean }): string[] {
    const status = getColors()[CHECK_STATUS_COLORS[result.status]](result.status);
    const scope = result.scope === '' ? '' : `${result.scope}  `;
    const lines = [`${scope}${result.check}  ${status}  ${formatCheckTail(result)}`.trimEnd()];
    if (verbose && result.command) lines.push(`  ${getColors().dim('$ ' + result.command.join(' '))}`);
    if (result.status === 'failed' || result.status === 'error')
        lines.push(...formatFindings(result.findings, { verbose }));
    if (result.reproduce !== undefined) lines.push(`  ${getColors().dim(RUN_AGAIN)} ${result.reproduce}`);
    return lines;
}

function formatIgnores(report: RunReport, { verbose }: { verbose: boolean }): string[] {
    if (report.ignores.length === 0) return [];
    if (!verbose) return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        return `ignore     ${ignore.check ?? EVERY_CHECK}${rule}${paths}  ${getColors().dim(ignore.reason)}`;
    });
}

function formatSummary(report: RunReport, { selectedOnly }: { selectedOnly: boolean }): string {
    const failed = report.checks.filter((check) => check.status === 'failed');
    const missing = report.checks.filter((check) => check.status === 'missing');
    const needsInstall = missing.some((check) => (check.note ?? '').endsWith(STANDARD_INSTALL_HELP));
    const errors = report.checks.filter((check) => check.status === 'error').length;
    const passed = report.checks.filter((check) => check.status === 'passed').length;
    const skipped = report.checks.filter((check) => check.status === 'skipped').length;
    const findings = failed.reduce((count, check) => count + check.findings.length, 0);
    const sentences = [];
    if (failed.length > 0)
        sentences.push(`Failed: ${formatCount(failed.length, 'check')} with ${formatCount(findings, 'finding')}.`);
    if (missing.length + errors > 0)
        sentences.push(
            `Could not run: ${formatCount(missing.length + errors, 'check')}${needsInstall && !selectedOnly ? TOOL_MISSING_MESSAGE : ''}.`,
        );
    sentences.push(`Passed: ${formatCount(passed, 'check')}.`, `Skipped: ${formatCount(skipped, 'check')}.`);
    const text = sentences.join(' ');
    return report.exitCode === 0 ? text : getColors().red(text);
}

function formatComparison(comparison: RunReport['comparison']): string {
    if (comparison === undefined) return '';
    return comparison.content === 'working-tree'
        ? `Checked the files changed since ${comparison.reference}.\n`
        : `Checked ${formatCheckedContent(comparison)}.\n`;
}

function formatMissingChecks(checks: readonly CheckResult[], { selectedOnly }: { selectedOnly: boolean }): string[] {
    const grouped = new Map<string, CheckResult[]>();
    for (const check of checks) {
        if (check.status !== 'missing') continue;
        const note = check.note ?? '';
        grouped.set(note, [...(grouped.get(note) ?? []), check]);
    }
    return [...grouped].flatMap(([note, missing]) => [
        `missing  ${missing.map((check) => [check.check, check.scope].filter(Boolean).join(' ')).join(', ')}`,
        `  ${!selectedOnly && note.endsWith(STANDARD_INSTALL_HELP) ? note.slice(0, -STANDARD_INSTALL_HELP.length) : note}`,
        '',
    ]);
}

function formatNotChecked(notChecked: RunReport['notChecked']): string[] {
    if (notChecked === undefined) return [];
    const choices = notChecked.map(({ configuration, evidence }) => `${configuration} (${evidence})`).join(', ');
    return [`note     Not checked: ${choices}. Run gspot add <name>, or gspot remove <name> --reason "<why>".`];
}

/**
Print failed fixer warnings, with the full diagnostics when requested.

@param fixes the fixer results.
@param options the diagnostic verbosity.
@param options.verbose whether to include the full fixer output.
*/
export function printFailedFixers(fixes: FixReport, { verbose }: { verbose: boolean }): void {
    for (const result of fixes.results) {
        if (result.status !== 'failed') continue;
        const note = stripControlCharacters(result.note);
        const detail =
            note
                .split('\n')
                .find((line) => FIXER_ERROR_PREFIX.test(line))
                ?.replace(FIXER_ERROR_PREFIX, '') ??
            note.split('\n', 1)[0] ??
            '';
        const failure = detail.endsWith('.') ? detail.slice(0, -1) : detail;
        process.stderr.write(
            `${getColors().yellow('[warn]')} The ${stripControlCharacters(result.check)} fixer failed: ${failure}. Run gspot check --only ${quoteArgument(stripControlCharacters(result.check))} --fix --verbose.\n`,
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

/**
Format the check lines, the ignores, and the summary of a run.

@param report the check results and totals.
@param options how to show the report.
@param options.selectedOnly whether the user selected checks explicitly.
@param options.verbose whether to show passing and skipped checks, their commands, every finding, and each ignore.
*/
export function formatRunReport(report: RunReport, options: { verbose: boolean; selectedOnly?: boolean }): string {
    const { verbose, selectedOnly = false } = options;
    const checks = report.checks.filter(
        (check) => verbose || (check.status !== 'passed' && check.status !== 'skipped'),
    );
    const lines = checks
        .filter((check) => check.status !== 'missing')
        .flatMap((check) => [...formatCheck(check, { verbose }), '']);
    lines.push(
        ...formatMissingChecks(checks, { selectedOnly }),
        ...formatNotChecked(report.notChecked),
        ...report.notes.map((note) => `note     ${note}`),
        ...formatIgnores(report, { verbose }),
        ...formatUnstagedChanges(report),
        formatSummary(report, { selectedOnly }),
        `Time: ${(report.duration / MILLISECONDS_PER_SECOND).toFixed(1)}s. Exit code ${String(report.exitCode)}.`,
    );
    return `${formatComparison(report.comparison)}${lines.join('\n')}\n`;
}

/**
Rewrite the progress line when stderr points to a terminal.

@param progress the last finished check and its place in the run.
*/
export function printProgress(progress: CheckProgress): void {
    if (!process.stderr.isTTY) return;
    const subject = formatCheckedContent(progress.comparison);
    process.stderr.write(
        `${PROGRESS_CLEAR}Checking ${subject}: ${String(progress.finished)} of ${String(progress.total)} checks done`,
    );
}

/**
Format the fixes as lines: the changed files and the files that the fixers broke.

@param fixes the fixer report.
*/
export function formatFixes(fixes: FixReport): string[] {
    const count = fixes.changed.length;
    if (count === 0 && fixes.broken.length === 0) return [UNCHANGED_FIX_MESSAGE];
    return [
        ...(count === 0
            ? []
            : [`Fixed ${formatCount(count, 'file')}: ${fixes.changed.join(', ')}. The changes are not staged.`]),
        ...fixes.broken.map(
            (path) => `The fixers left a syntax error in ${path}; gspot put back the file as it was before the fixers.`,
        ),
    ];
}
