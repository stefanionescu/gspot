// JSON, SARIF, and GitLab Code Quality reports.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { toolPath } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/checks.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import packageManifest from '#package' with { type: 'json' };
import { reportStorageFailure } from '#cli/output/messages.ts';
import { PACKAGE_JSON_INDENT } from '#cli/config/generation.ts';
import { PRIVATE_FILE, REPORT_DIRECTORY } from '#cli/config/platform.ts';
import type { RunReport, PushReport } from '#cli/types/execution/execution.ts';
import { SarifBuilder, SarifRunBuilder, SarifRuleBuilder, SarifResultBuilder } from 'node-sarif-builder';

const { version: GSPOT_VERSION } = packageManifest;

function locationOf(finding: Finding): { fileUri: string; startLine: number; startColumn: number } | undefined {
    if (finding.file === '') return undefined;
    return {
        fileUri: finding.file,
        startLine: Math.max(1, finding.line ?? 1),
        startColumn: Math.max(1, finding.column ?? 1),
    };
}

/**
 * Render located findings using GitLab's Code Quality format.
 * @param report the run report, or the push report with one run per revision
 * @returns the Code Quality JSON text
 */
function codeQualityText(report: RunReport | PushReport): string {
    const reports = 'revisions' in report ? report.revisions.map((revision) => revision.report) : [report];
    const findings = reports.flatMap((entry) => [
        ...entry.checks.flatMap((check) => check.findings),
        ...entry.coverage.findings,
    ]);
    const seen = new Set<string>();
    const entries = findings
        .map((finding) => ({ finding, path: toolPath(finding.file).replace(/^\.\//u, '') }))
        .filter(
            ({ path }) =>
                path !== '' && !path.startsWith('/') && !/^[a-zA-Z]:/u.test(path) && !path.split('/').includes('..'),
        )
        .flatMap(({ finding, path }) => {
            const check = finding.rule === undefined ? finding.check : `${finding.check}:${finding.rule}`;
            const line = Math.max(1, finding.line ?? 1);
            const fingerprint = createHash('sha256')
                .update(JSON.stringify([check, path, line, finding.column ?? 1, finding.message]))
                .digest('hex');
            if (seen.has(fingerprint)) return [];
            seen.add(fingerprint);
            return [
                {
                    description: finding.message,
                    check_name: check,
                    fingerprint,
                    severity: 'major',
                    location: { path, lines: { begin: line } },
                },
            ];
        });
    return `${JSON.stringify(entries, null, PACKAGE_JSON_INDENT)}\n`;
}

/**
 * The SARIF rendering of a report, with locations for findings that have them.
 * @param report the run report
 * @returns the SARIF JSON text
 */
function sarifRun(report: RunReport): SarifRunBuilder {
    const run = new SarifRunBuilder().initSimple({ toolDriverName: 'gspot', toolDriverVersion: report.version });
    if (report.comparison !== undefined) run.run.properties = { comparison: report.comparison };
    const errors = report.checks.filter((check) => check.status === 'error' || check.status === 'missing');
    run.run.invocations = [
        {
            executionSuccessful: errors.length === 0,
            toolExecutionNotifications: errors.map((check) => ({
                level: 'error',
                message: { text: `${check.check}: ${check.note ?? check.status}` },
                properties: { check: check.check, scope: check.scope },
            })),
        },
    ];
    const rules = new Set<string>();
    const findings = [...report.checks.flatMap((check) => check.findings), ...report.coverage.findings];
    for (const finding of findings) {
        const ruleId = finding.rule === undefined ? finding.check : `${finding.check}:${finding.rule}`;
        if (!rules.has(ruleId)) {
            rules.add(ruleId);
            run.addRule(
                new SarifRuleBuilder().initSimple({ ruleId, shortDescriptionText: finding.help ?? finding.message }),
            );
        }
        run.addResult(
            new SarifResultBuilder().initSimple({
                ruleId,
                level: 'error',
                messageText: finding.message,
                ...locationOf(finding),
            }),
        );
    }
    return run;
}

/**
 * Writes the JSON, SARIF, and Code Quality reports, replacing those of the last run.
 * @param root the repository root
 * @param report the run report
 */
export function writeReport(root: string, report: RunReport | PushReport): void {
    const outputs = [
        ['report.json', `${JSON.stringify(report, null, PACKAGE_JSON_INDENT)}\n`],
        ['report.sarif', sarifText(report)],
        ['report.codequality.json', codeQualityText(report)],
    ] as const;
    try {
        const files = openRoot(root);
        try {
            for (const [name, content] of outputs) {
                const path = `${REPORT_DIRECTORY}/${name}`;
                files.write(path, { bytes: Buffer.from(content), mode: PRIVATE_FILE }, files.read(path));
            }
        } finally {
            files.close();
        }
    } catch (error) {
        reportStorageFailure(join(root, REPORT_DIRECTORY, 'report.json'), error);
    }
}

/**
 * Render each pushed revision as a separate SARIF run, retaining every verdict.
 * @param report the run report, or the push report with one run per revision
 * @returns the SARIF JSON text
 */
export function sarifText(report: RunReport | PushReport): string {
    const builder = new SarifBuilder();
    for (const entry of 'revisions' in report ? report.revisions.map((revision) => revision.report) : [report])
        builder.addRun(sarifRun(entry));
    if ('revisions' in report && report.canceled !== undefined) {
        const canceled = new SarifRunBuilder().initSimple({
            toolDriverName: 'gspot',
            toolDriverVersion: GSPOT_VERSION,
        });
        canceled.run.properties = { canceled: report.canceled };
        canceled.run.invocations = [
            {
                executionSuccessful: false,
                toolExecutionNotifications: [
                    {
                        level: 'error',
                        message: {
                            text: `Push checks canceled. References not checked: ${report.canceled.pendingRefs.join(', ') || 'none; inspect canceled checks'}.`,
                        },
                    },
                ],
            },
        ];
        builder.addRun(canceled);
    }
    return builder.buildSarifJsonString({ indent: true });
}
