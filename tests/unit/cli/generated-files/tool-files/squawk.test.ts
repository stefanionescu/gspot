import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/values.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { toolFileFor, generateFile } from '#tests/setup/tool-files.ts';
import { CHILD_MIGRATIONS, CHILD_POSTGRES_TABLES } from '#tests/data/checks/sql.ts';

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
    [
        'all',
        [
            'migrations/10_next.sql',
            'migrations/2_initial.sql',
            'migrations/9007199254740992_large.sql',
            'migrations/9007199254740993_later.sql',
            'migrations/V2_initial.sql',
            'migrations/V9007199254740992_large.sql',
            'migrations/V9007199254740993_later.sql',
        ],
    ],
])('Squawk skips migrations through version %s without rounding', async (through, expected) => {
    const text = await generateFile(
        buildSettingsText(['postgres'], { tables: `[postgres]\nfrozen_through = "${through}"\n` }),
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
    expect(getValueAt(parse(text), ['excluded_paths'])).toStrictEqual(expected);
});

test('a Postgres child scope writes its frozen migrations', async () => {
    await using sandbox = await testdir({
        ...CHILD_MIGRATIONS,
        'gspot.toml': buildSettingsText([], { level: 'all', tables: CHILD_POSTGRES_TABLES }),
    });
    const session = await openSession(sandbox.path);
    const path = toolFileFor(session, 'squawk', 'app');
    const text = generate(session).files.find((file) => file.path === path)!.content;
    expect(getValueAt(parse(text), ['excluded_paths'])).toStrictEqual([
        'app/migrations/V2_first.sql',
        'migrations/V1_root.sql',
        'other/migrations/V1_other.sql',
    ]);
});
