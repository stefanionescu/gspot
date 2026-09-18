// .gspot/last.json, --json, and the SARIF rendering.
import { join } from 'node:path';
import type { Finding } from '#types/finding.ts';
import type { RunRecord } from '#types/record.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
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
 * Writes .gspot/last.json and .gspot/last.sarif.
 * @param root the repository root
 * @param record the run record
 */
export function writeRecord(root: string, record: RunRecord): void {
    mkdirSync(join(root, '.gspot'), { recursive: true });
    writeFileSync(join(root, '.gspot', 'last.json'), `${JSON.stringify(record, null, JSON_INDENT)}\n`);
    writeFileSync(join(root, '.gspot', 'last.sarif'), sarifText(record));
}

/**
 * The SARIF rendering of a record, with locations for findings that have them.
 * @param record the run record
 * @returns the SARIF JSON text
 */
export function sarifText(record: RunRecord): string {
    const builder = new SarifBuilder();
    const run = new SarifRunBuilder().initSimple({ toolDriverName: 'gspot', toolDriverVersion: record.version });
    const rules = new Set<string>();
    const findings = record.checks.flatMap((check) => check.findings);
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
