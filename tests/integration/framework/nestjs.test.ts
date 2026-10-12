import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { containing } from '#tests/setup/matchers.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareInstalledSandbox } from '#tests/setup/sandbox.ts';
import testManifest from '#tests/package.json' with { type: 'json' };
import { NESTJS_CASES, NESTJS_SANDBOX } from '#tests/config/nestjs.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';

const installedSandbox = shareInstalledSandbox({
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
        await runCheckSample(installedSandbox(), entry, NESTJS_SANDBOX);
    });
}

test('the Swagger lint rules apply only when package.json declares @nestjs/swagger', async () => {
    const repository = installedSandbox();
    const { root, environment } = repository;
    const packagePath = join(root, 'package.json');
    const settingsPath = join(root, 'gspot.toml');
    const original = await Bun.file(packagePath).text();
    const settings = await Bun.file(settingsPath).text();
    const manifest = JSON.parse(original) as PackageJson;
    try {
        const selected = await spawnGspot(root, ['set', 'level', 'all'], environment);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        await Bun.write(
            packagePath,
            JSON.stringify({
                ...manifest,
                dependencies: { ...manifest.dependencies, '@nestjs/swagger': '11.2.3' },
            }),
        );
        const applied = await spawnGspot(root, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const failed = await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json'], environment);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
            containing({
                file: 'src/greeting.controller.ts',
                rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
                line: 7,
            }),
        );
        await Bun.write(packagePath, original);
        const restored = await spawnGspot(root, ['apply'], environment);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        const accepted = await spawnGspot(root, ['check', '--only', 'javascript/eslint', '--json'], environment);
        expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        expect((JSON.parse(accepted.stdout) as RunReport).checks).toMatchObject([
            { check: 'javascript/eslint', status: 'passed', findings: [] },
        ]);
    } finally {
        await Bun.write(packagePath, original);
        await Bun.write(settingsPath, settings);
        await spawnGspot(root, ['apply'], environment);
    }
});
