import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { CI_PINS } from '#cli/config/generation/ci.ts';
import { runCommand } from '#tests/setup/processes.ts';
import type { PackedSandbox } from '#tests/types/e2e.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildSpawnEnvironment } from '#cli/system/environment.ts';
import { setUpPackedSandbox, createPackedSandbox } from '#tests/setup/e2e-sandbox.ts';

const FAKE_MISE = `console.log(${JSON.stringify(CI_PINS.mise.version)});\n`;

/** Prepare package data and private formatter inputs with the declared mise executable first. */
async function prepareFormatterSandbox(installation: PackedSandbox) {
    const toolConsumer = join(installation.workspace, 'tool-consumer');
    const systemTools = join(installation.workspace, 'system-tools');
    await mkdir(toolConsumer);
    await fakeTool(systemTools, 'mise', FAKE_MISE);
    const bun = await runCommand(['bun', '--version'], {
        cwd: toolConsumer,
        env: installation.onlineOptions.env,
    });
    if (bun.code !== 0) throw new Error(`Bun version failed: ${bun.stdout}${bun.stderr}`);
    const authoredPackage = JSON.stringify({
        private: true,
        packageManager: `bun@${bun.stdout.trim()}`,
        scripts: { test: 'authored-command' },
    });
    await writeFile(join(toolConsumer, 'package.json'), authoredPackage);
    await writeFile(join(toolConsumer, 'source.js'), 'export const greeting="hello";');
    const toolOptions = {
        ...installation.onlineOptions,
        cwd: toolConsumer,
        env: {
            ...installation.onlineOptions.env,
            PATH: `${systemTools}${delimiter}${installation.onlineOptions.env['PATH'] ?? ''}`,
            NO_PROXY: '127.0.0.1,localhost',
        },
    };
    await setUpPackedSandbox(
        { ...installation, onlineOptions: toolOptions },
        {
            cwd: toolConsumer,
            configurations: ['format'],
            level: 'all',
        },
    );
    return { toolConsumer, toolOptions, authoredPackage };
}

test('the installed formatter reports and fixes source and keeps your package.json fields', async () => {
    await using consumer = await createPackedSandbox(buildSpawnEnvironment()['GSPOT_TEST_NPMRC']!);

    const { command } = consumer;
    const { toolConsumer, toolOptions, authoredPackage } = await prepareFormatterSandbox(consumer);
    const formatter = [...command, 'check', 'source.js', '--only', 'format/prettier', '--json'];
    const invalid = await runCommand(formatter, toolOptions);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks).toMatchObject([
        { check: 'format/prettier', status: 'failed', findings: [{ file: 'source.js' }] },
    ]);
    const fixed = await runCommand([...formatter, '--fix'], toolOptions);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    const valid = await runCommand(formatter, toolOptions);
    expect(valid.code, valid.stdout + valid.stderr).toBe(0);
    expect(await readFile(join(toolConsumer, 'package.json'), 'utf8')).toBe(authoredPackage);
});
