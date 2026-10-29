import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { VUE_CASES, VUE_SANDBOX } from '#tests/config/integration/checks/framework/vue.ts';

const installedSandbox = shareInstalledSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: testsPackage.devDependencies.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
