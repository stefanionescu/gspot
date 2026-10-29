import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { REACT_CASES, WEB_TSCONFIG, CLEAN_COMPONENT } from '#tests/config/integration/checks/framework/react.ts';

const installedSandbox = shareInstalledSandbox({
    ...({
        configurations: ['typescript', 'react-dom'],
        json: { 'tsconfig.json': WEB_TSCONFIG },
        files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
    } as const),
    dependencies: {
        '@types/react': testsPackage.devDependencies['@types/react'],
        react: testsPackage.devDependencies.react,
        'react-dom': testsPackage.devDependencies['react-dom'],
    },
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
