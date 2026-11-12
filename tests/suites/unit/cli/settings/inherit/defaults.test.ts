import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { POSTGRES_ORIGIN } from '#tests/config/settings/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test("a written false overrides a configuration's true default", async () => {
    const source = buildSandboxSettings(['postgres'], { rules: true });
    await using sandbox = await createGitSandbox({ 'gspot.toml': source });
    const initial = await openSession(sandbox.path);
    expect(
        getSettingValue(initial.scopes[0]!.availableSettings, initial.settings, 'postgres.assume_in_transaction', ''),
    ).toMatchObject({ value: true, origin: POSTGRES_ORIGIN });
    await writeFile(join(sandbox.path, 'gspot.toml'), `${source}[postgres]\nassume_in_transaction = false\n`);
    const corrected = await openSession(sandbox.path);
    expect(
        getSettingValue(
            corrected.scopes[0]!.availableSettings,
            corrected.settings,
            'postgres.assume_in_transaction',
            '',
        ),
    ).toMatchObject({ value: false, origin: { kind: 'root', name: 'gspot.toml' } });
});

test('an inherited default names the configuration that declares it', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['supabase'], { rules: true }) });
    const { settings, scopes } = await openSession(sandbox.path);
    expect(getSettingValue(scopes[0]!.availableSettings, settings, 'sql.dialect', '')).toMatchObject({
        origin: POSTGRES_ORIGIN,
    });
});
