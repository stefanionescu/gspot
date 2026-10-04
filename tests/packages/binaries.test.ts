// Compile and unpack a native release archive, then run built-in checks without JavaScript runtimes on PATH.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

import {
    BROKEN_SQL,
    BINARY_CHECKS,
    CORRECTED_SQL,
    BROKEN_MARKDOWN,
    CORRECTED_MARKDOWN,
    RETIRED_WORKER_FILES,
} from '#tests/config/packages/binaries.ts';

/** Builds, verifies, and extracts the host archive through the delivered release producer. */
async function extractVerifiedArchive(destination: string): Promise<string> {
    const target = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
    const built = await runTestCommand([process.execPath, 'scripts/binaries.ts', target], {
        cwd: root,
        timeoutMs: NATIVE_TEST_TIMEOUT_MS,
    });
    expect(built.code, built.stdout + built.stderr).toBe(0);
    const folder = `gspot-${packageManifest.version}-${target}`;
    const distribution = join(root, 'packages/cli/dist-binaries');
    const archive = `${folder}.tar.gz`;
    const hash = createHash('sha256')
        .update(readFileSync(join(distribution, archive)))
        .digest('hex');
    expect(readFileSync(join(distribution, 'SHA256SUMS'), 'utf8')).toContain(`${hash}  ${archive}\n`);
    const extracted = await runTestCommand(['tar', '-xzf', join(distribution, archive), '-C', destination], {
        cwd: root,
        timeoutMs: NATIVE_TEST_TIMEOUT_MS,
    });
    expect(extracted.code, extracted.stdout + extracted.stderr).toBe(0);
    const binary = join(destination, folder, process.platform === 'win32' ? 'gspot.exe' : 'gspot');
    const assets = readdirSync(join(destination, folder));
    expect(assets).toContain('worker.js');
    expect(assets.filter((asset) => RETIRED_WORKER_FILES.includes(asset))).toStrictEqual([]);
    return binary;
}

test(
    'the standalone archive preserves its assets, checksum, and source diagnostics without Node.js or Bun on PATH',
    async () => {
        await using sandbox = await testdir();
        const consumer = join(sandbox.path, 'consumer');
        const binary = await extractVerifiedArchive(sandbox.path);
        const path =
            process.platform === 'win32' ? join(environmentVariables()['SystemRoot']!, 'System32') : '/usr/bin:/bin';
        expect([Bun.which('node', { PATH: path }), Bun.which('bun', { PATH: path })]).toStrictEqual([null, null]);
        await createFileTree(consumer, {
            'gspot.toml': buildPolicy(['markdown', 'sql'], {
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
                level: 'all',
            }),
            'example.md': BROKEN_MARKDOWN,
            'query.sql': BROKEN_SQL,
        });
        const options = {
            cwd: consumer,
            env: { PATH: path, CI: '1', NO_COLOR: '1' },
            timeoutMs: NATIVE_TEST_TIMEOUT_MS,
        };
        const version = await runTestCommand([binary, '--version'], options);
        expect(version.code, version.stderr).toBe(0);
        expect(version.stdout.trim()).toBe(packageManifest.version);
        const args = [binary, 'check', '--json', '--only', ...BINARY_CHECKS];
        const failed = await runTestCommand(args, options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            { check: 'markdown/fences', status: 'failed', findings: [{ file: 'example.md' }] },
            { check: 'sql/syntax', status: 'failed', findings: [{ file: 'query.sql' }] },
        ]);
        writeFileSync(join(consumer, 'example.md'), CORRECTED_MARKDOWN);
        writeFileSync(join(consumer, 'query.sql'), CORRECTED_SQL);
        const passed = await runTestCommand(args, options);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect((JSON.parse(passed.stdout) as RunReport).checks).toMatchObject([
            { check: 'markdown/fences', status: 'passed', findings: [] },
            { check: 'sql/syntax', status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
