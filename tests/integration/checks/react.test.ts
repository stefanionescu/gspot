import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { REACT_CASES, WEB_PACKAGES, REACT_SANDBOX } from '#tests/data/checks/react.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({
    ...REACT_SANDBOX,
    dependencies: Object.fromEntries(WEB_PACKAGES.map((name) => [name, testsPackage.devDependencies[name]])),
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, REACT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
