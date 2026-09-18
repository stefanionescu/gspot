// Check lines, findings, help lines, reproduce lines, the summary; columns from the longest id.
import { paint } from '#cli/output/messages.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import type { RunRecord } from '#types/run-record.ts';

export type ReportOptions = { quiet: boolean; verbose: boolean; docsBase?: string };

function pad(text: string, width: number): string {
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)}s`;
}

function fileCount(count: number): string {
    return `${count} file${count === 1 ? '' : 's'}`;
}

function statusWord(result: CheckResult): string {
    const { red, green, yellow, dim } = paint();
    switch (result.status) {
        case 'ok':
            return green('ok');
        case 'cache':
            return dim('cache');
        case 'fail':
            return red('fail');
        case 'missing':
            return red('missing');
        case 'error':
            return red('error');
        case 'skipped':
            return yellow('skip');
    }
}

function findingLine(finding: Finding, docsBase: string | undefined): string[] {
    const { dim, cyan } = paint();
    const location =
        finding.file === ''
            ? ''
            : `${finding.file}${finding.line !== undefined ? `:${finding.line}` : ''}${finding.column !== undefined ? `:${finding.column}` : ''}`;
    const rule = finding.rule ?? finding.check;
    const link = docsBase ? dim(` ${docsBase}/${finding.check}`) : '';
    const lines = [`  ${location === '' ? '' : `${location}  `}${cyan(rule)}  ${finding.message}${link}`];
    if (finding.help) lines.push(`    ${dim('help:')} ${finding.help}`);
    return lines;
}

/** Renders the run the way 02-cli.md shows it. Returns the text for stdout. */
export function renderRun(record: RunRecord, options: ReportOptions): string {
    const { dim, red } = paint();
    const lines: string[] = [];
    const shown = record.checks.filter(
        (check) => !(options.quiet && (check.status === 'ok' || check.status === 'cache')),
    );
    const scopeWidth = Math.max(4, ...record.checks.map((check) => (check.scope === '' ? 'root' : check.scope).length));
    const idWidth = Math.max(8, ...record.checks.map((check) => check.id.length));
    for (const check of shown) {
        const scope = pad(check.scope === '' ? 'root' : check.scope, scopeWidth);
        const tail =
            check.status === 'missing' || check.status === 'error' || check.status === 'skipped'
                ? (check.note ?? '')
                : `${pad(fileCount(check.files), 11)} ${check.status === 'cache' ? '' : seconds(check.duration)}`;
        lines.push(
            `${scope}  ${pad(check.id, idWidth)}  ${pad(statusWord(check), options.verbose ? 9 : 9)}  ${tail}`.trimEnd(),
        );
        if (options.verbose && check.command) lines.push(`  ${dim(`$ ${check.command.join(' ')}`)}`);
        if (check.status === 'fail') {
            const findings = check.findings.slice(0, options.verbose ? check.findings.length : 200);
            for (const finding of findings) lines.push(...findingLine(finding, options.docsBase));
            if (check.findings.length > findings.length)
                lines.push(
                    `  ${dim(`and ${check.findings.length - findings.length} more (--verbose prints every finding)`)}`,
                );
        }
        if (check.reproduce) lines.push(`  ${dim('reproduce:')} ${check.reproduce}`);
    }
    const held = record.baselines.filter((verdict) => verdict.held);
    const tailStart = lines.length;
    for (const verdict of record.baselines.filter((entry) => !entry.held))
        lines.push(
            `${red('baseline exceeded')}  ${verdict.check}:${verdict.rule}  ${verdict.count} of ${verdict.baseline}`,
        );
    for (const verdict of held)
        lines.push(`baselines  ${verdict.check}:${verdict.rule}  ${verdict.count} of ${verdict.baseline}`);
    const ignoreCount = record.ignores.length;
    if (ignoreCount > 0) {
        if (options.verbose)
            for (const ignore of record.ignores)
                lines.push(
                    `ignore     ${ignore.check}${ignore.rule ? ` ${ignore.rule}` : ''}${ignore.paths ? ` ${ignore.paths.join(' ')}` : ''}  ${dim(ignore.reason)}  (${ignore.matched} matched)`,
                );
        else lines.push(`ignores    ${ignoreCount} (printed with --verbose)`);
    }
    for (const skip of record.skips) lines.push(`skipped    ${skip.check}  ${dim(`(${skip.source})`)}`);
    if (record.coverage.unchecked > 0) lines.push(`unchecked  ${fileCount(record.coverage.unchecked)} (gspot doctor)`);
    if (record.unstaged > 0)
        lines.push(
            `checked working tree; ${record.unstaged} file${record.unstaged === 1 ? ' has' : 's have'} unstaged changes`,
        );
    if (lines.length > tailStart && tailStart > 0) lines.splice(tailStart, 0, '');
    if (lines.length > 0) lines.push('');
    lines.push(
        record.failed.length > 0
            ? red(`failed: ${record.failed.join(', ')}`)
            : options.quiet && shown.length === 0
              ? 'passed'
              : `passed: ${record.checks.length} check${record.checks.length === 1 ? '' : 's'}`,
    );
    return `${lines.join('\n')}\n`;
}
