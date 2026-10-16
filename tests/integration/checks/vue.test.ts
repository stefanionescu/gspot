import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { VUE_CASES, VUE_SANDBOX } from '#tests/data/checks/vue.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({
    ...VUE_SANDBOX,
    dependencies: { vue: testsPackage.devDependencies.vue },
});

test.each([...VUE_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, VUE_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
