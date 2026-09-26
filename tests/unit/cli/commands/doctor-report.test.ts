import { expect, test } from 'bun:test';
import { stripVTControlCharacters } from 'node:util';
import { configureOutput } from '#cli/output/messages.ts';
import { doctorText } from '#cli/commands/doctor/report.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';

const report: DoctorReport = {
    tools: [
        { name: 'first', state: 'ok', want: '1.0', path: '/tools/first' },
        { name: 'second', state: 'outdated', found: '1.0', want: '2.0', note: 'Upgrade second' },
        { name: 'third', state: 'newer', found: '3.0', want: '2.0', note: 'Pin third' },
        { name: 'fourth', state: 'host', found: '123.456.789', path: '/tools/fourth' },
    ],
    submodules: [],
    coverage: { endings: [], unchecked: [], partial: [], checked: 0 },
    changes: {
        detectedNotSelected: [],
        recommendedNotSelected: [],
        configurationNotOwned: [],
        changedOutsideGspot: [],
        pinnedTwice: [],
    },
    hooks: 'none',
    ci: 'none',
    rules: { files: 0 },
    version: { running: '0.1.0' },
    exitCode: 1,
};

test('Doctor aligns status and displayed versions with and without color', () => {
    configureOutput({ verbosity: 'normal', json: false, color: false });
    const plain = doctorText(report);
    try {
        configureOutput({ verbosity: 'normal', json: false, color: true });
        const colored = doctorText(report);
        expect(colored).not.toBe(plain);
        expect(stripVTControlCharacters(colored)).toBe(plain);
        const rows = plain.split('\n').slice(1, 5);
        expect(rows.map((row, index) => row.indexOf(['first', 'second', 'third', 'fourth'][index]!))).toStrictEqual([
            12, 12, 12, 12,
        ]);
        expect(
            rows.map((row, index) =>
                row.indexOf(['/tools/first', 'Upgrade second', 'Pin third', '/tools/fourth'][index]!),
            ),
        ).toStrictEqual([39, 39, 39, 39]);
    } finally {
        configureOutput({ verbosity: 'normal', json: false, color: false });
    }
});
