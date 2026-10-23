import { test, expect } from 'bun:test';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { VUE_CASES, VUE_SANDBOX } from '#tests/config/integration/checks/framework/vue.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const installedSandbox = shareInstalledSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: testsPackage.devDependencies.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    const result = await runCheckSample(installedSandbox(), sample, VUE_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
