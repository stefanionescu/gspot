import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/tables.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { generateFile, findConfigFilePath } from '#tests/setup/cli/config-files.ts';

import {
    CHILD_MIGRATIONS,
    SQUAWK_VERSION_CASES,
    SQUAWK_MIGRATION_FILES,
    CHILD_POSTGRES_SCOPE_TABLES,
} from '#tests/data/generation/config-files/builders/squawk.ts';

test.each([...SQUAWK_VERSION_CASES])(
    'Squawk skips migrations through version %s without rounding',
    async (through, expected) => {
        const text = await generateFile(
            buildSandboxSettings(['postgres'], { tables: `[postgres]\nfrozen_through = "${through}"\n` }),
            '.gspot/configurations/database/postgres/squawk.toml',
            SQUAWK_MIGRATION_FILES,
        );
        expect(getValueAt(parse(text), ['excluded_paths'])).toStrictEqual(expected);
    },
);

test('the Squawk config file of a Postgres child scope excludes the frozen migrations of every scope', async () => {
    await using sandbox = await testdir({
        ...CHILD_MIGRATIONS,
        'gspot.toml': buildSandboxSettings([], { level: 'all', tables: CHILD_POSTGRES_SCOPE_TABLES }),
    });
    const session = await openSession(sandbox.path);
    const path = findConfigFilePath(session, 'squawk', 'app');
    const text = generate(session).files.find((file) => file.path === path)!.content;
    expect(getValueAt(parse(text), ['excluded_paths'])).toStrictEqual([
        'app/migrations/V2_first.sql',
        'migrations/V1_root.sql',
        'other/migrations/V1_other.sql',
    ]);
});

test('the Squawk config file of a Postgres scope assumes that each migration runs in a transaction', async () => {
    const text = await generateFile(
        buildSandboxSettings(['postgres']),
        '.gspot/configurations/database/postgres/squawk.toml',
        SQUAWK_MIGRATION_FILES,
    );
    expect(getValueAt(parse(text), ['assume_in_transaction'])).toBe(true);
});
