import { test, expect } from 'bun:test';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';
import { REACT_CASES, WEB_PACKAGES, REACT_SANDBOX } from '#tests/config/integration/checks/framework/react.ts';

const installedSandbox = shareInstalledSandbox({
    ...REACT_SANDBOX,
    dependencies: Object.fromEntries(WEB_PACKAGES.map((name) => [name, testsPackage.devDependencies[name]])),
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, REACT_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
