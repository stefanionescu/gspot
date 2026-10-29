import { test, describe } from 'bun:test';
import { hasToolBuild } from '#tests/setup/system/platform.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { SUPABASE_CASES } from '#tests/config/integration/checks/supabase.ts';
import { SUPABASE_SANDBOX } from '#tests/config/integration/checks/samples.ts';

describe.skipIf(!hasToolBuild('deno'))('Supabase samples', () => {
    const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);

    test.each([...SUPABASE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        await assertCheckSample(installedSandbox(), sample);
    });
});
