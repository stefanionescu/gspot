import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import { readPolicy } from '#cli/policy/read.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { XML_INSTALL_HINTS } from '#tests/config/cli/tools/hints.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

test.each([...XML_INSTALL_HINTS])(
    'a missing host XML reader reports $platform acquisition guidance without requesting a managed install',
    async ({ platform, hint }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { tables: 'run_with = "mise"\n' }),
        });
        const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
        const current = environmentVariables();
        const previous = { PATH: current['PATH'], MISE_DATA_DIR: current['MISE_DATA_DIR'] };
        try {
            setEnvironmentVariable('PATH', join(sandbox.path, 'empty-bin'));
            setEnvironmentVariable('MISE_DATA_DIR', join(sandbox.path, 'mise'));
            Object.defineProperty(process, 'platform', { value: platform });
            const tool = toolPin(configurationManifests().values(), 'xmllint');
            expect(inspectTool({ root: sandbox.path, inspections: new Map() }, tool)).toMatchObject({
                name: 'xmllint',
                state: 'missing',
                hint,
            });
            const context = {
                root: sandbox.path,
                inspections: new Map(),
                policyFiles: readPolicy(sandbox.path),
            };
            expect(inspectTool(context, tool)).toMatchObject({ name: 'xmllint', state: 'missing', hint });
        } finally {
            Object.defineProperty(process, 'platform', descriptor);
            for (const [name, value] of Object.entries(previous)) setEnvironmentVariable(name, value);
        }
    },
);

test('doctor and a missing XML check report the host installation prerequisite', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const binaries = join(sandbox.path, 'binaries');
    mkdirSync(binaries);
    for (const name of ['git', 'node']) {
        const executable = Bun.which(name);
        expect(executable, `${name} is required for CLI metadata inspection.`).not.toBeNull();
        const windowsName = `${name}.exe`;
        const filename = process.platform === 'win32' ? windowsName : name;
        symlinkSync(executable!, join(binaries, filename));
    }
    await createFileTree(root, {
        'gspot.toml': buildPolicy([]),
        'document.xml': '<root />\n',
        'package.json': '{"private":true,"packageManager":"npm@10.9.0"}\n',
    });
    const hint = XML_INSTALL_HINTS.find(({ platform }) => platform === process.platform)!.hint;
    const environment = { PATH: binaries, MISE_DATA_DIR: join(sandbox.path, 'mise') };
    const doctor = await runGspot(root, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools).toContainEqual(
        containing({ name: 'xmllint', state: 'missing', hint }),
    );
    const checked = await runGspot(root, ['check', 'document.xml', '--only', 'files/xmllint', '--json'], environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
        { check: 'files/xmllint', status: 'missing', findings: [], note: `xmllint is not installed. ${hint}` },
    ]);
});
