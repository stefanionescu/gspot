import { test, expect } from 'bun:test';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import testManifest from '#tests/package.json' with { type: 'json' };
import { NESTJS_CASES, NESTJS_SANDBOX } from '#tests/data/checks/nestjs.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({
    ...NESTJS_SANDBOX,
    dependencies: {
        '@nestjs/common': testManifest.devDependencies['@nestjs/common'],
        '@nestjs/core': testManifest.devDependencies['@nestjs/core'],
        'reflect-metadata': testManifest.devDependencies['reflect-metadata'],
        rxjs: testManifest.devDependencies.rxjs,
    },
});

for (const entry of NESTJS_CASES) {
    test(`${entry.check} reports ${entry.expected.file} and passes after the fix`, async () => {
        const result = await runCheckSample(installedSandbox(), entry, NESTJS_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}
