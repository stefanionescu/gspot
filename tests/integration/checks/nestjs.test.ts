import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { NESTJS_CASES, NESTJS_SANDBOX } from '#tests/data/checks/nestjs.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({
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
