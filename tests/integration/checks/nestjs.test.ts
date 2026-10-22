import { test, expect } from 'bun:test';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { NESTJS_CASES, NESTJS_SANDBOX } from '#tests/data/checks/nestjs.ts';
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

test.each([...NESTJS_CASES])('$check reports $expected.file and passes after the fix', async (entry) => {
    const result = await runCheckSample(installedSandbox(), entry, NESTJS_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
