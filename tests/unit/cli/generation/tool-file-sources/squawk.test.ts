import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitFile } from '#tests/setup/generate.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHILD_MIGRATIONS, CHILD_POSTGRES_TABLES } from '#tests/config/sql.ts';

test.each([
    ['2', ['migrations/2_initial.sql', 'migrations/V2_initial.sql']],
    [
        '9007199254740992',
        [
            'migrations/10_next.sql',
            'migrations/2_initial.sql',
            'migrations/9007199254740992_large.sql',
            'migrations/V2_initial.sql',
            'migrations/V9007199254740992_large.sql',
        ],
    ],
])('Squawk skips migrations through version %s without rounding', async (through, expected) => {
    const text = await emitFile(
        settingsText(['postgres'], { tables: `[postgres]\nfrozen_through = "${through}"\n` }),
        '.gspot/config/squawk.toml',
        {
            'migrations/2_initial.sql': 'SELECT 1;\n',
            'migrations/10_next.sql': 'SELECT 1;\n',
            'migrations/9007199254740992_large.sql': 'SELECT 1;\n',
            'migrations/9007199254740993_later.sql': 'SELECT 1;\n',
            'migrations/V2_initial.sql': 'SELECT 1;\n',
            'migrations/V9007199254740992_large.sql': 'SELECT 1;\n',
            'migrations/V9007199254740993_later.sql': 'SELECT 1;\n',
        },
    );
    expect(parse(text)['excluded_paths']).toStrictEqual(expected);
});

test('frozen_through = all skips every migration', async () => {
    const text = await emitFile(
        settingsText(['postgres'], { tables: '[postgres]\nfrozen_through = "all"\n' }),
        '.gspot/config/squawk.toml',
        { 'migrations/20260101_initial.sql': 'select 1;\n' },
    );
    expect(parse(text)['excluded_paths']).toStrictEqual(['migrations/20260101_initial.sql']);
});

test('a Postgres child scope writes its frozen migrations', async () => {
    const text = await emitFile(
        settingsText([], { level: 'all', tables: CHILD_POSTGRES_TABLES }),
        '.gspot/config/app/squawk.toml',
        CHILD_MIGRATIONS,
    );
    expect(parse(text)['excluded_paths']).toStrictEqual([
        'app/migrations/V2_first.sql',
        'migrations/V1_root.sql',
        'other/migrations/V1_other.sql',
    ]);
});
