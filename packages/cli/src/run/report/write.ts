// .gspot/report.json, --json, and the SARIF rendering.
import { join } from 'node:path';
import type { Finding } from '#types/finding.ts';
import type { RunReport } from '#types/report.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { reportStorageFailure } from '#cli/output/messages.ts';
import { SarifBuilder, SarifResultBuilder, SarifRuleBuilder, SarifRunBuilder } from 'node-sarif-builder';

const JSON_INDENT = 4;

function ruleIdOf(finding: Finding): string {
    return finding.rule === undefined ? finding.check : `${finding.check}:${finding.rule}`;
}

function locationOf(finding: Finding): { fileUri: string; startLine: number; startColumn: number } | undefined {
    if (finding.file === '') return undefined;
    return {
        fileUri: finding.file,
        startLine: Math.max(1, finding.line ?? 1),
        startColumn: Math.max(1, finding.column ?? 1),
    };
}

/**
 * Writes .gspot/report.json and .gspot/report.sarif.
 * @param root the repository root
 * @param report the run report
 */
export function writeReport(root: string, report: RunReport): void {
    const json = `${JSON.stringify(report, null, JSON_INDENT)}\n`;
    const sarif = sarifText(report);
    let path = join(root, '.gspot', 'report.json');
    try {
        mkdirSync(join(root, '.gspot'), { recursive: true });
        writeFileSync(path, json);
        path = join(root, '.gspot', 'report.sarif');
        writeFileSync(path, sarif);
    } catch (error) {
        reportStorageFailure(path, error);
    }
}

/**
 * The SARIF rendering of a report, with locations for findings that have them.
 * @param report the run report
 * @returns the SARIF JSON text
 */
export function sarifText(report: RunReport): string {
    const builder = new SarifBuilder();
    const run = new SarifRunBuilder().initSimple({ toolDriverName: 'gspot', toolDriverVersion: report.version });
    const rules = new Set<string>();
    const findings = report.checks.flatMap((check) => check.findings);
    for (const finding of findings) {
        const ruleId = ruleIdOf(finding);
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
    builder.addRun(run);
    return builder.buildSarifJsonString({ indent: true });
}
