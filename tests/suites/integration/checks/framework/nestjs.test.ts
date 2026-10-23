import { test, expect } from 'bun:test';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { NESTJS_SANDBOX } from '#tests/config/checks/framework/nestjs.ts';
import { NESTJS_CASES } from '#tests/config/integration/checks/framework/nestjs.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

const installedSandbox = shareInstalledSandbox({
    ...NESTJS_SANDBOX,
    dependencies: {
        '@nestjs/common': testsPackage.devDependencies['@nestjs/common'],
        '@nestjs/core': testsPackage.devDependencies['@nestjs/core'],
        'reflect-metadata': testsPackage.devDependencies['reflect-metadata'],
        rxjs: testsPackage.devDependencies.rxjs,
    },
});

test.each([...NESTJS_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
    const result = await runCheckSample(installedSandbox(), sample, NESTJS_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
