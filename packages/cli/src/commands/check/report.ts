import { styleText } from 'node:util';

import {
    CANCELED_RUN_MESSAGE,
    CHECK_STATUS_COLORS,
    FINDINGS_SHOWN,
    FIX_LABEL,
    FIX_SENTENCE,
    INSTALL_REMINDER,
    NOTE_STATUSES,
    RERUN_LABEL,
    SENTENCE_END,
    STANDARD_INSTALL_HELP,
    STATUS_LABEL_WIDTH,
    SUMMARY_STATUSES,
} from '#cli/config/commands/check.ts';
import { CODE_MARK } from '#cli/config/commands/help.ts';
import { EVERY_CHECK } from '#cli/config/configurations/gspot.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';
import { formatCheckedContent } from '#cli/engine/run/progress.ts';
import { formatScopePrefix } from '#cli/repository/scopes.ts';
import { formatCount, formatSeconds } from '#cli/system/text/messages.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type { CheckResult, CheckStatus, Finding, RunReport } from '#cli/types/engine/run.ts';

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

function formatFinding(finding: Finding, { verbose }: { verbose: boolean }): string[] {
    const rule =
        finding.rule === undefined || finding.rule === finding.check || Object.hasOwn(CHECK_STATUS_COLORS, finding.rule)
            ? ''
            : `${styleText('cyan', finding.rule, { stream: process.stdout })}  `;
    const lines = [
        `  ${formatLocation(finding)}${rule}${finding.message
            .split(LINE_BREAK)
            .map((line) => line.trim())
            .join(' ')}`,
    ];
    if (verbose && finding.diff !== undefined)
        lines.push(
            ...finding.diff
                .trimEnd()
                .split(LINE_BREAK)
                .map((line) => `    ${line}`),
        );
    return lines;
}

function formatHelpLines(
    findings: readonly Finding[],
    result: Pick<CheckResult, 'check' | 'help' | 'fixCommand'>,
): string[] {
    const groups = Map.groupBy(findings, (finding) => (finding.help ?? result.help ?? '').replaceAll(CODE_MARK, ''));
    return [...groups].map(([written, group]) => {
        const rest = written.replace(FIX_SENTENCE, '');
        const help = result.fixCommand === undefined ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}` : written;
        const [command, ...others] = new Set(group.map((finding) => finding.explain));
        const explain =
            command !== undefined && others.length === 0
                ? command
                : `gspot explain ${quoteArgument(result.check)} <rule>`;
        const text = `${help} Details: ${explain}`.trim();
        return `  ${styleText('dim', 'help:', { stream: process.stdout })} ${text}`;
    });
}

function formatCheckTail(result: CheckResult): string {
    if (NOTE_STATUSES.has(result.status)) return result.note ?? '';
    return result.status === 'failed'
        ? formatCount(result.findings.length, 'finding')
        : `${formatCount(result.fileCount, 'file')}  ${formatSeconds(result.duration)}`;
}

function formatFindings(result: CheckResult, { verbose }: { verbose: boolean }): string[] {
    const { findings } = result;
    const shown = verbose ? findings : findings.slice(0, FINDINGS_SHOWN);
    const lines = shown.flatMap((finding) => formatFinding(finding, { verbose }));
    const hidden = findings.length - shown.length;
    if (hidden > 0) {
        const message = `and ${String(hidden)} more (--verbose prints every finding)`;
        lines.push(`  ${styleText('dim', message, { stream: process.stdout })}`);
    }
    if (result.note !== undefined)
        lines.push(`  ${styleText('dim', 'note:', { stream: process.stdout })} ${result.note}`);
    return [...lines, ...formatHelpLines(shown, result)];
}

function formatReportLine(result: CheckResult, tail: string): string {
    const label =
        result.status === 'skipped' && result.cause !== undefined ? `skipped (${result.cause})` : result.status;
    const status = label.padEnd(STATUS_LABEL_WIDTH);
    const shown = styleText(CHECK_STATUS_COLORS[result.status], status, { stream: process.stdout });
    return `${shown}  ${formatScopePrefix(result.scope)}${result.check}  ${tail}`.trimEnd();
}

function formatVerboseLines({ command, stack }: CheckResult): string[] {
    const lines = stack?.split('\n').map((line) => `  ${line}`) ?? [];
    if (!command) return lines;
    const shown = styleText('dim', `$ ${command.join(' ')}`, { stream: process.stdout });
    return [`  ${shown}`, ...lines];
}

function formatCheck(result: CheckResult, { verbose }: { verbose: boolean }): string[] {
    const lines = [formatReportLine(result, formatCheckTail(result))];
    if (verbose) lines.push(...formatVerboseLines(result));
    if (['failed', 'error', 'canceled'].includes(result.status)) lines.push(...formatFindings(result, { verbose }));
    if (result.fixCommand !== undefined)
        lines.push(`  ${styleText('dim', FIX_LABEL, { stream: process.stdout })} ${result.fixCommand}`);
    if (result.rerun !== undefined)
        lines.push(`  ${styleText('dim', RERUN_LABEL, { stream: process.stdout })} ${result.rerun}`);
    return lines;
}

function formatIgnores(report: RunReport, { verbose }: { verbose: boolean }): string[] {
    if (report.ignores.length === 0) return [];
    if (!verbose) return [`ignores    ${String(report.ignores.length)} (printed with --verbose)`];
    return report.ignores.map((ignore) => {
        const rule = ignore.rule === undefined ? '' : ` ${ignore.rule}`;
        const paths = ignore.paths === undefined ? '' : ` ${ignore.paths.join(' ')}`;
        return `ignore     ${ignore.check ?? EVERY_CHECK}${rule}${paths}  ${styleText('dim', ignore.reason, { stream: process.stdout })}`;
    });
}

function listWorstStatuses(checks: readonly CheckResult[]): Array<CheckStatus | undefined> {
    return Map.groupBy(checks, ({ check }) => check)
        .values()
        .map((rows) => SUMMARY_STATUSES.find((status) => rows.some((row) => row.status === status)))
        .toArray();
}

function formatIncompleteCounts({ checks }: RunReport, worst: Array<CheckStatus | undefined>): string[] {
    const missing = checks.filter((check) => check.status === 'missing');
    const environments = missing.filter((check) => check.note === PROJECT_ENVIRONMENT_MESSAGE);
    const tools = new Set(
        missing.filter((check) => check.note !== PROJECT_ENVIRONMENT_MESSAGE).map(({ note }) => note),
    );
    const hasInstallNote = [...tools].some((note) => note?.endsWith(STANDARD_INSTALL_HELP) === true);
    const errors = worst.filter((status) => status === 'error').length;
    const canceled = worst.filter((status) => status === 'canceled').length;
    return [
        ...(tools.size === 0 ? [] : [`Missing tools: ${String(tools.size)}${hasInstallNote ? INSTALL_REMINDER : ''}.`]),
        ...(environments.length === 0 ? [] : [`Missing environments: ${String(environments.length)}.`]),
        ...(errors === 0 ? [] : [`Errors: ${String(errors)}.`]),
        ...(canceled === 0 ? [] : [`Canceled: ${formatCount(canceled, 'check')}.`]),
    ];
}

function formatSummary(report: RunReport): string {
    const worst = listWorstStatuses(report.checks);
    const failed = worst.filter((status) => status === 'failed').length;
    const passed = worst.filter((status) => status === 'passed').length;
    const skipped = Object.values(report.skippedCount).reduce((total, count) => total + count, 0);
    const findings = report.checks.flatMap((check) => (check.status === 'failed' ? check.findings : [])).length;
    const text = [
        ...(failed === 0 ? [] : [`Failed: ${formatCount(failed, 'check')} with ${formatCount(findings, 'finding')}.`]),
        ...formatIncompleteCounts(report, worst),
        `Passed: ${formatCount(passed, 'check')}.`,
        `Skipped: ${formatCount(skipped, 'check')}.`,
    ].join(' ');
    return report.exitCode === 0 ? text : styleText('red', text, { stream: process.stdout });
}

function formatComparison(comparison: RunReport['comparison']): string {
    if (comparison === null) return '';
    return comparison.content === 'working-tree'
        ? `Checked the files changed since ${comparison.reference}.\n`
        : `Checked ${formatCheckedContent(comparison)}.\n`;
}

function formatMissingGroup(note: string, missing: readonly CheckResult[]): string {
    const [first] = missing as readonly [CheckResult];
    if (missing.length === 1) return formatReportLine(first, note);
    const names = [...new Set(missing.map(({ check }) => check))].join(', ');
    const scopes = new Set(missing.map(({ scope }) => scope)).size;
    const where = scopes === 1 ? names : `${names} in ${String(scopes)} scopes`;
    const label = styleText('red', first.status.padEnd(STATUS_LABEL_WIDTH), { stream: process.stdout });
    const sentence = note.replace(SENTENCE_END, () => ` (${where}).`);
    return `${label}  ${sentence}`;
}

function formatMissingChecks(checks: readonly CheckResult[]): string[] {
    const groups = Map.groupBy(
        checks.filter((check) => check.status === 'missing'),
        ({ note = '' }) => note,
    );
    const lines = [...groups].map(([note, missing]) => formatMissingGroup(note, missing));
    return lines.length === 0 ? [] : [...lines, ''];
}

export function formatRunReport(
    report: RunReport,
    {
        verbose,
        canceled = false,
        startCommand,
    }: { verbose: boolean; canceled?: boolean; startCommand?: string | undefined },
): string {
    const checks = report.checks.filter(
        (check) => verbose || (check.status !== 'passed' && check.status !== 'skipped'),
    );
    const lines = checks.flatMap((check) =>
        check.status === 'missing' ? [] : [...formatCheck(check, { verbose }), ''],
    );
    const ending = canceled ? CANCELED_RUN_MESSAGE : `Exit code ${String(report.exitCode)}.`;
    lines.push(
        ...formatMissingChecks(checks),
        ...report.notes.map((note) => `note     ${note}`),
        ...(report.exitCode === 0 || startCommand === undefined
            ? []
            : [`note     To run the lines above, write ${startCommand} in place of gspot.`]),
        ...formatIgnores(report, { verbose }),
        ...formatUnstagedChanges(report),
        formatSummary(report),
        `Time: ${formatSeconds(report.duration)}. ${ending}`,
    );
    return `${formatComparison(report.comparison)}${lines.join('\n')}\n`;
}
