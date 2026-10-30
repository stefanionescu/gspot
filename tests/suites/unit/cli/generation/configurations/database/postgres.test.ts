import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { findValueAt } from '#cli/system/tables.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget, getConfigFilePath, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

import {
    CHILD_MIGRATIONS,
    SQUAWK_VERSION_CASES,
    SQUAWK_MIGRATION_FILES,
    CHILD_POSTGRES_SCOPE_TABLES,
} from '#tests/config/generation/configurations/database.ts';

test.each([...SQUAWK_VERSION_CASES])(
    'Squawk skips migrations through version %s without rounding',
    async (through, expected) => {
        const text = await buildGeneratedFile(
            buildSandboxSettings(['postgres'], { tables: `[postgres]\nfrozen_through = "${through}"\n` }),
            getManifestTarget('postgres', 'squawk.toml'),
            SQUAWK_MIGRATION_FILES,
        );
        expect(findValueAt(parse(text), ['excluded_paths'])).toStrictEqual(expected);
    },
);

test('the Squawk config file of a Postgres child scope excludes the frozen migrations of every scope', async () => {
    await using sandbox = await testdir({
        ...CHILD_MIGRATIONS,
        'gspot.toml': buildSandboxSettings([], { level: 'all', tables: CHILD_POSTGRES_SCOPE_TABLES }),
    });
    const session = await openSession(sandbox.path);
    const path = getConfigFilePath(session, 'squawk', 'app');
    const text = buildGeneratedFiles(session).files.find((file) => file.path === path)!.content;
    expect(findValueAt(parse(text), ['excluded_paths'])).toStrictEqual([
        'app/migrations/V2_first.sql',
        'migrations/V1_root.sql',
        'other/migrations/V1_other.sql',
    ]);
});
