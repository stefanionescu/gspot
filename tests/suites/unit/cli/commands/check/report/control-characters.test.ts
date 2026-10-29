import { test, spyOn, expect } from 'bun:test';
import { type RunReport } from '#cli/types/commands/check.ts';
import { formatRunReport } from '#cli/commands/check/report.ts';
import { printResult, setOutputOptions } from '#cli/system/terminal.ts';
import { FAILED_CHECK_REPORT } from '#tests/config/commands/check/report.ts';

test('finding text removes terminal controls and JSON preserves the diagnostic as escaped data', () => {
    const message = 'Before\u001B[2Kafter\u0000\u0007\u007F';
    const report = structuredClone(FAILED_CHECK_REPORT) as RunReport;
    report.checks[0]!.findings[0]!.message = message;
    const chunks: string[] = [];
    using _stdout = spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        chunks.push(String(chunk));
        return true;
    });
    try {
        setOutputOptions({ isJson: false, colored: false });
        const text = formatRunReport(report, { verbose: true });
        printResult({ text, json: report, exitCode: 1 });
        expect(chunks.join('')).toContain('Beforeafter');
        expect(chunks.join('')).not.toContain('\u001B');
        expect(chunks.join('')).not.toContain('\u0000');
        chunks.length = 0;
        setOutputOptions({ isJson: true, colored: false });
        printResult({ text, json: report, exitCode: 1 });
        expect(chunks.join('')).not.toContain('\u001B');
        expect(JSON.parse(chunks.join(''))).toStrictEqual(report);
    } finally {
        setOutputOptions({ isJson: false, colored: false });
    }
});
