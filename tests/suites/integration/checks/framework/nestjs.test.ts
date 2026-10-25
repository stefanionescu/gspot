import { test, expect } from 'bun:test';
import { NESTJS_SANDBOX } from '#tests/config/nestjs.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';
import { NESTJS_CASES } from '#tests/config/integration/checks/framework/nestjs.ts';

const installedSandbox = shareInstalledSandbox({
    ...NESTJS_SANDBOX,
    dependencies: {
        '@nestjs/common': testsPackage.devDependencies['@nestjs/common'],
        '@nestjs/core': testsPackage.devDependencies['@nestjs/core'],
        'reflect-metadata': testsPackage.devDependencies['reflect-metadata'],
        rxjs: testsPackage.devDependencies.rxjs,
    },
});

test.each([...NESTJS_CASES])('$name and passes after the fix', async (sample) => {
    const summary = await runCheckSample(installedSandbox(), sample);
    expect(summary).toStrictEqual(expectedSummary(sample));
    expect(summary.failed.reported[0]?.findings.map(({ rule }) => rule)).toStrictEqual([...sample.rules]);
});
