import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';

test.each([
    ['2', ['migrations/2_initial.sql']],
    [
        '9007199254740992',
        ['migrations/10_next.sql', 'migrations/2_initial.sql', 'migrations/9007199254740992_large.sql'],
    ],
])('Squawk excludes numeric migration versions through %s without rounding', async (through, expected) => {
    const text = await emitFile(
        buildPolicy(['postgres'], { tables: `[postgres]\nfrozen_through = "${through}"\n` }),
        '.gspot/config/squawk.toml',
        {
            'migrations/2_initial.sql': 'SELECT 1;\n',
            'migrations/10_next.sql': 'SELECT 1;\n',
            'migrations/9007199254740992_large.sql': 'SELECT 1;\n',
            'migrations/9007199254740993_later.sql': 'SELECT 1;\n',
        },
    );
    expect(parse(text)['excluded_paths']).toStrictEqual(expected);
});

test('freezing all migrations excludes every discovered migration from Squawk', async () => {
    const text = await emitFile(
        buildPolicy(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        '.gspot/config/squawk.toml',
        { 'migrations/20260101_initial.sql': 'select 1;\n' },
    );
    expect(parse(text)['excluded_paths']).toStrictEqual(['migrations/20260101_initial.sql']);
});
