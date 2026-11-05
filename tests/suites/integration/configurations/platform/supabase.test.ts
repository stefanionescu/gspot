import { describe, test } from 'bun:test';

import { SUPABASE_SANDBOX } from '#tests/config/integration/commands.ts';
import { SUPABASE_CASES } from '#tests/config/integration/infrastructure.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { hasToolBuild } from '#tests/setup/system/platform.ts';

describe.skipIf(!hasToolBuild('deno'))('Supabase samples', () => {
    const installedSandbox = shareInstalledSandbox(SUPABASE_SANDBOX);

    test.each([...SUPABASE_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        await assertCheckSample(installedSandbox(), sample);
    });
});
