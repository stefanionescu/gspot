// .gspot/last.json, --json, and the SARIF rendering.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { SarifBuilder, SarifResultBuilder, SarifRuleBuilder, SarifRunBuilder } from 'node-sarif-builder';

import type { RunRecord } from '#types/run-record.ts';

/** Writes .gspot/last.json and .gspot/last.sarif. */
export function writeRecord(root: string, record: RunRecord): void {
    mkdirSync(join(root, '.gspot'), { recursive: true });
    writeFileSync(join(root, '.gspot', 'last.json'), `${JSON.stringify(record, null, 4)}\n`);
    writeFileSync(join(root, '.gspot', 'last.sarif'), sarifText(record));
}

/** The SARIF rendering of a record, with locations for findings that have them. */
export function sarifText(record: RunRecord): string {
    const builder = new SarifBuilder();
    const run = new SarifRunBuilder().initSimple({ toolDriverName: 'gspot', toolDriverVersion: record.version });
    const rules = new Set<string>();
    for (const check of record.checks) {
        for (const finding of check.findings) {
            const ruleId = finding.rule ? `${finding.check}:${finding.rule}` : finding.check;
            if (!rules.has(ruleId)) {
                rules.add(ruleId);
                run.addRule(
                    new SarifRuleBuilder().initSimple({
                        ruleId,
                        shortDescriptionText: finding.help ?? finding.message,
                    }),
                );
            }
            const result = new SarifResultBuilder().initSimple({
                ruleId,
                level: 'error',
                messageText: finding.message,
                ...(finding.file
                    ? { fileUri: finding.file, startLine: finding.line ?? 1, startColumn: finding.column ?? 1 }
                    : {}),
            });
            run.addResult(result);
        }
    }
    builder.addRun(run);
    return builder.buildSarifJsonString({ indent: true });
}
