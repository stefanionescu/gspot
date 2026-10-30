import { test } from 'bun:test';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { REACT_CASES, WEB_TSCONFIG, CLEAN_COMPONENT } from '#tests/config/integration/checks/framework/framework.ts';

const installedSandbox = shareInstalledSandbox({
    ...({
        configurations: ['typescript', 'react-dom'],
        json: { 'tsconfig.json': WEB_TSCONFIG },
        files: { 'src/Greeting.tsx': CLEAN_COMPONENT },
    } as const),
    dependencies: {
        '@types/react': SANDBOX_PACKAGES['@types/react'],
        react: SANDBOX_PACKAGES.react,
        'react-dom': SANDBOX_PACKAGES['react-dom'],
    },
});

test.each([...REACT_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
