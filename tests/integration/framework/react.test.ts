import { test } from 'bun:test';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { REACT_CASES, WEB_PACKAGES, REACT_SANDBOX } from '#tests/config/react.ts';

const installedSandbox = shareInstalledSandbox({
    ...REACT_SANDBOX,
    dependencies: Object.fromEntries(WEB_PACKAGES.map((name) => [name, testsPackage.devDependencies[name]])),
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await runCheckSample(installedSandbox(), entry, REACT_SANDBOX);
});
