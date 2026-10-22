import { test, expect, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { SUPABASE_CASES } from '#tests/config/integration/checks/supabase.ts';
import { SUPABASE_SANDBOX } from '#tests/config/integration/checks/samples.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

describe.skipIf(!hasToolBuild('deno'))('Supabase samples', () => {
    const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);

    test.each([...SUPABASE_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
        const result = await runCheckSample(installedSandbox(), entry, SUPABASE_SANDBOX);
        expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
    });
});
