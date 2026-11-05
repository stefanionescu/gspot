import { test } from 'bun:test';

import { VUE_CASES, VUE_SANDBOX } from '#tests/config/integration/vue.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: SANDBOX_PACKAGES.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
