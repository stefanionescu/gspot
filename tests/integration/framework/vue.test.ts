import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { VUE_CASES, VUE_SANDBOX } from '#tests/config/vue.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };

const installedSandbox = shareInstalledSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: testsPackage.devDependencies.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await runCheckSample(installedSandbox(), entry, VUE_SANDBOX);
});
