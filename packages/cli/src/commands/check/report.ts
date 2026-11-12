import { randomUUID } from 'node:crypto';
import { styleText } from 'node:util';

import { CODE_MARK } from '#cli/config/commands/help.ts';
import {
    CANCELED_RUN_MESSAGE,
    CHECK_STATUS_COLORS,
    FINDINGS_SHOWN,
    FIX_LABEL,
    FIXER_ERROR_PREFIX,
    INSTALL_REMINDER,
    NOTE_STATUSES,
    RERUN_LABEL,
    SENTENCE_END,
    STANDARD_INSTALL_HELP,
    STATUS_LABEL_WIDTH,
    UNCHANGED_FIX_MESSAGE,
} from '#cli/config/commands/reports.ts';
import { EVERY_CHECK } from '#cli/config/engine.ts';
import { LINE_BREAK } from '#cli/config/system.ts';
import { PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';
import { formatCheckedContent } from '#cli/engine/report.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { print, printWarning } from '#cli/system/terminal.ts';
import { formatCount, formatScopePrefix, formatSeconds, quoteArgument } from '#cli/system/text.ts';
import type { CheckCommandJson } from '#cli/types/commands.ts';
import type { CheckResult, CheckStatus, Finding, FixReport, RunReport } from '#cli/types/engine/run.ts';

const GITHUB_ANNOTATION_LIMIT = 10;

const ANNOTATION_ESCAPES: Readonly<Record<string, string>> = {
    '%': '%25',
    '\r': '%0D',
    '\n': '%0A',
    ':': '%3A',
    ',': '%2C',
};

const ANNOTATION_MESSAGE_CHARACTERS = /[%\r\n]/gu;

const ANNOTATION_PROPERTY_CHARACTERS = /[%\r\n:,]/gu;

const FIX_SENTENCE = /^Run the fix: command that the report prints[^.,;]*(?:\.|, then |; )\s*/u;

const SUMMARY_STATUSES: readonly CheckStatus[] = ['failed', 'error', 'canceled', 'missing', 'passed', 'skipped'];

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
    return command ? [`  ${styleText('dim', '$ ' + command.join(' '), { stream: process.stdout })}`, ...lines] : lines;
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

export function printFailedFixers(fixes: FixReport, { verbose }: { verbose: boolean }): void {
    for (const result of fixes.results) {
        if (result.status !== 'failed') continue;
        const note = result.note;
        const detail =
            note
                .split('\n')
                .find((line) => FIXER_ERROR_PREFIX.test(line))
                ?.replace(FIXER_ERROR_PREFIX, '') ??
            note.split('\n', 1)[0] ??
            '';
        const failure = detail.endsWith('.') ? detail.slice(0, -1) : detail;
        const toolOutput = verbose
            ? '\n' +
              note
                  .split('\n')
                  .map((line) => '  ' + line)
                  .join('\n')
            : '';
        printWarning(`The ${result.check} fixer failed: ${failure}.${toolOutput}`);
    }
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

/**
Format one GitHub error annotation per finding, up to the number of error annotations that GitHub shows for one step.
The annotations print after the report, once workflow commands run again. The escapes keep tool text from closing a
property or from starting a second command.
*/
export function formatAnnotations(json: CheckCommandJson): string[] {
    if (readEnvironmentVariable('GITHUB_ACTIONS') !== 'true' || 'error' in json) return [];
    const reports = 'revisions' in json ? json.revisions.map(({ report }) => report) : [json];
    const findings = reports.flatMap(({ checks }) => checks.flatMap((check) => check.findings));
    return findings.slice(0, GITHUB_ANNOTATION_LIMIT).map((finding) => {
        const properties = [
            ['file', finding.file === '' ? undefined : finding.file],
            ['line', finding.line === undefined ? undefined : String(finding.line)],
            ['col', finding.column === undefined ? undefined : String(finding.column)],
            ['title', [finding.check, finding.rule].filter((name) => name !== undefined).join(' ')],
        ] as const;
        const fields = properties.flatMap(([name, value]) =>
            value === undefined
                ? []
                : [
                      `${name}=${value.replaceAll(ANNOTATION_PROPERTY_CHARACTERS, (character) => ANNOTATION_ESCAPES[character] ?? character)}`,
                  ],
        );
        const message = finding.message.replaceAll(
            ANNOTATION_MESSAGE_CHARACTERS,
            (character) => ANNOTATION_ESCAPES[character] ?? character,
        );
        return `::error ${fields.join(',')}::${message}`;
    });
}

/**
Stop GitHub workflow command parsing until the check's output has finished.
*/
export function beginCheckReport(): (() => void) | undefined {
    if (readEnvironmentVariable('GITHUB_ACTIONS') !== 'true') return undefined;
    const token = randomUUID();
    print(`::stop-commands::${token}`);
    return () => {
        print(`::${token}::`);
    };
}

export function formatFixes(fixes: FixReport): string[] {
    const count = fixes.changed.length;
    if (count === 0 && fixes.broken.length === 0 && fixes.conflicted.length === 0) return [UNCHANGED_FIX_MESSAGE];
    return [
        ...(count === 0
            ? []
            : [`Fixed ${formatCount(count, 'file')}: ${fixes.changed.join(', ')}. The changes are not staged.`]),
        ...fixes.broken.map(
            (path) => `The fixers left a syntax error in ${path}; gspot put back the file as it was before the fixers.`,
        ),
        ...fixes.conflicted.map((path) => `The fixers skipped ${path}, because it holds merge-conflict markers.`),
    ];
}
