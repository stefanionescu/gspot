import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { findValueAt } from '#cli/system/tables.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SQUAWK_ALL_LEVEL_ON } from '#cli/config/configurations/postgres.ts';
import { getConfigPath, getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

import {
    CHILD_MIGRATIONS,
    SQUAWK_MIGRATION_FILES,
    CHILD_POSTGRES_SCOPE_TABLES,
} from '#tests/config/configurations/database.ts';

test('Squawk skips migrations through version 9007199254740992 without rounding', async () => {
    const text = await buildGeneratedFile(
        buildSandboxSettings(['postgres'], { tables: '[postgres]\nfrozen_through = "9007199254740992"\n' }),
        getManifestTarget('postgres', 'squawk.toml'),
        SQUAWK_MIGRATION_FILES,
    );
    expect(findValueAt(parse(text), ['excluded_paths'])).toStrictEqual([
        'migrations/10_next.sql',
        'migrations/2_initial.sql',
        'migrations/9007199254740992_large.sql',
        'migrations/V2_initial.sql',
    ]);
});

test('the Squawk config file of a Postgres child scope excludes the frozen migrations of every scope', async () => {
    await using sandbox = await createGitSandbox({
        ...CHILD_MIGRATIONS,
        'gspot.toml': buildSandboxSettings([], { level: 'all', tables: CHILD_POSTGRES_SCOPE_TABLES }),
    });
    const session = await openSession(sandbox.path);
    const path = getConfigPath(session, 'squawk', 'app');
    const text = buildGeneratedFiles(session).files.find((file) => file.path === path)!.content;
    expect(findValueAt(parse(text), ['excluded_paths'])).toStrictEqual([
        'app/migrations/V2_first.sql',
        'migrations/V1_root.sql',
        'other/migrations/V1_other.sql',
    ]);
});

test('an all-level squawk rule that is turned off is excluded, not included', async () => {
    const [rule] = SQUAWK_ALL_LEVEL_ON;
    const ignore = `[[ignore]]\ncheck = "postgres/squawk"\nrule = "${rule}"\nreason = "Every table sits in public."\n`;
    const config = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['postgres'], { level: 'all', tables: ignore }),
            getManifestTarget('postgres', 'squawk.toml'),
            { 'migrations/1_teams.sql': 'SELECT 1;\n' },
        ),
    ) as Record<string, unknown>;
    expect(findValueAt(config, ['excluded_rules'])).toContain(rule);
    expect(findValueAt(config, ['included_rules'])).not.toContain(rule);
});
