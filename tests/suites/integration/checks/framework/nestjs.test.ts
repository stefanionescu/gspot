import { test } from 'bun:test';
import { NESTJS_SANDBOX } from '#tests/config/nestjs.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { NESTJS_CASES } from '#tests/config/integration/checks/framework/nestjs.ts';

const installedSandbox = shareInstalledSandbox({
    ...NESTJS_SANDBOX,
    dependencies: {
        '@nestjs/common': SANDBOX_PACKAGES['@nestjs/common'],
        '@nestjs/core': SANDBOX_PACKAGES['@nestjs/core'],
        'reflect-metadata': SANDBOX_PACKAGES['reflect-metadata'],
        rxjs: SANDBOX_PACKAGES.rxjs,
    },
});

test.each([...NESTJS_CASES])('$name and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
