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
import { LINE_BREAK } from '#cli/config/parsers.ts';
import { BASELINE_FILE } from '#cli/config/repository/files.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { PROJECT_ENVIRONMENT_MESSAGE } from '#cli/config/tools/programs.ts';
import { selectCheckCode } from '#cli/configurations/registry.ts';
import { formatCheckedContent } from '#cli/engine/report.ts';
import { formatExplainCommand } from '#cli/engine/results.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { print, printWarning } from '#cli/system/terminal.ts';
import { formatCount, formatScope, quoteArgument } from '#cli/system/text.ts';
import type { CheckCommandJson } from '#cli/types/commands/reports.ts';
import type { CheckResult, FixReport, RunReport } from '#cli/types/engine/run.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';

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

/**
Print each help text once after the findings of a check. The explain command names the rule when every finding of
that help shares one, and a rule placeholder when they name several.

@param findings the findings that the report shows.
@param result the check, and its help that a finding of its own help replaces.
*/
function formatHelpLines(findings: readonly Finding[], result: Pick<CheckResult, 'check' | 'help'>): string[] {
    const groups = Map.groupBy(findings, (finding) => (finding.help ?? result.help ?? '').replaceAll(CODE_MARK, ''));
    return [...groups].map(([help, group]) => {
        const [command, ...others] = new Set(
            group.map((finding) => finding.explain ?? formatExplainCommand(finding, selectCheckCode)),
        );
        const explain =
            command !== undefined && others.length === 0
                ? command
                : `gspot explain ${quoteArgument(result.check)} <rule>`;
        const text = help === '' ? explain : `${help} ${explain}`;
        return `  ${styleText('dim', 'help:', { stream: process.stdout })} ${text}`;
    });
}

function formatCheckTail(result: CheckResult): string {
    if (NOTE_STATUSES.has(result.status)) return result.note ?? '';
    return result.status === 'failed'
        ? formatCount(result.findings.length, 'finding')
        : `${formatCount(result.fileCount, 'file')}  ${(result.duration / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
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
    return [...lines, ...formatHelpLines(shown, result)];
}

function formatReportLine(result: CheckResult, tail: string): string {
    const label =
        result.status === 'skipped' && result.cause !== undefined ? `skipped (${result.cause})` : result.status;
    const status = label.padEnd(STATUS_LABEL_WIDTH);
    const shown = styleText(CHECK_STATUS_COLORS[result.status], status, { stream: process.stdout });
    const scope = result.scope === '' ? '' : `${formatScope(result.scope)}  `;
    return `${shown}  ${scope}${result.check}  ${tail}`.trimEnd();
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

function formatBaselined({ baselined }: RunReport): string[] {
    const count = Object.values(baselined).reduce((total, each) => total + each, 0);
    return count === 0 ? [] : [`baselined  ${String(count)} (counted in ${BASELINE_FILE})`];
}

function formatIncompleteCounts({ checks }: RunReport): string[] {
    const missing = checks.filter((check) => check.status === 'missing');
    const environments = missing.filter((check) => check.note === PROJECT_ENVIRONMENT_MESSAGE);
    const tools = new Set(
        missing.filter((check) => check.note !== PROJECT_ENVIRONMENT_MESSAGE).map(({ note }) => note),
    );
    const hasInstallNote = [...tools].some((note) => note?.endsWith(STANDARD_INSTALL_HELP) === true);
    const errors = checks.filter((check) => check.status === 'error').length;
    const canceled = checks.filter((check) => check.status === 'canceled').length;
    return [
        ...(tools.size === 0 ? [] : [`Missing tools: ${String(tools.size)}${hasInstallNote ? INSTALL_REMINDER : ''}.`]),
        ...(environments.length === 0 ? [] : [`Missing environments: ${String(environments.length)}.`]),
        ...(errors === 0 ? [] : [`Errors: ${String(errors)}.`]),
        ...(canceled === 0 ? [] : [`Canceled: ${formatCount(canceled, 'check')}.`]),
    ];
}

function formatSummary(report: RunReport): string {
    const failed = report.checks.filter((check) => check.status === 'failed');
    const passed = report.checks.filter((check) => check.status === 'passed').length;
    const skipped = Object.values(report.skippedCount).reduce((total, count) => total + count, 0);
    const findings = failed.reduce((count, check) => count + check.findings.length, 0);
    const text = [
        ...(failed.length === 0
            ? []
            : [`Failed: ${formatCount(failed.length, 'check')} with ${formatCount(findings, 'finding')}.`]),
        ...formatIncompleteCounts(report),
        `Passed: ${formatCount(passed, 'check')}.`,
        `Skipped: ${formatCount(skipped, 'check')}.`,
    ].join(' ');
    return report.exitCode === 0 ? text : styleText('red', text, { stream: process.stdout });
}

function formatComparison(comparison: RunReport['comparison']): string {
    if (comparison === undefined) return '';
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

/**
Print failed fixer warnings, with the full diagnostics when requested.

@param fixes the fixer results.
@param options the report verbosity.
@param options.verbose whether to include the full fixer output.
*/
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
        printWarning(
            `The ${result.check} fixer failed: ${failure}. Run gspot check --only ${quoteArgument(result.check)} --fix --verbose.${toolOutput}`,
        );
    }
}

/**
Format the check lines, the ignores, and the summary of a run.

@param report the check results and totals.
@param options how to show the report.
@param options.verbose whether to show passing and skipped checks, their commands, every finding, and each ignore.
@param options.canceled whether a signal stopped the run, so it ends without its exit code.
@param options.setup the milliseconds from the start of the run to the first check, which --verbose prints.
*/
export function formatRunReport(
    report: RunReport,
    { verbose, canceled = false, setup }: { verbose: boolean; canceled?: boolean; setup?: number },
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
        ...formatIgnores(report, { verbose }),
        ...formatBaselined(report),
        ...formatUnstagedChanges(report),
        formatSummary(report),
        ...(verbose && setup !== undefined
            ? [`Setup: ${(setup / MILLISECONDS_PER_SECOND).toFixed(1)}s before the first check.`]
            : []),
        `Time: ${(report.duration / MILLISECONDS_PER_SECOND).toFixed(1)}s. ${ending}`,
    );
    return `${formatComparison(report.comparison)}${lines.join('\n')}\n`;
}

/**
Format one GitHub error annotation per finding, up to the number of error annotations that GitHub shows for one step.
The annotations print after the report, once workflow commands run again. The escapes keep tool text from closing a
property or from starting a second command.

@param json the report of the check command.
@returns no line outside GitHub Actions.
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

/**
Format the fixes as lines: the changed files and the files that the fixers broke.

@param fixes the fixer report.
*/
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
