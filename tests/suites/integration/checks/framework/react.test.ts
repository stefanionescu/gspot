import { test, expect } from 'bun:test';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';
import { REACT_CASES, REACT_SANDBOX } from '#tests/config/integration/checks/framework/react.ts';

const installedSandbox = shareInstalledSandbox({
    ...REACT_SANDBOX,
    dependencies: {
        '@types/react': testsPackage.devDependencies['@types/react'],
        react: testsPackage.devDependencies.react,
        'react-dom': testsPackage.devDependencies['react-dom'],
    },
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    expect(await runCheckSample(installedSandbox(), sample)).toStrictEqual(buildExpectedSummary(sample));
});
