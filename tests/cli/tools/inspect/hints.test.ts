import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { mkdir, symlink } from 'node:fs/promises';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { inspectTool } from '#cli/tools/inspect.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { usePlatform } from '#tests/harness/platforms.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';

// Acquisition commands use the package names declared by the host installers.
function installerHint(tool: ToolPin, platform: string): string {
    const system = OPERATING_SYSTEMS.find(({ node }) => node === platform)!;
    const declared = system.installers.find(({ installer }) => tool.installers[installer] !== undefined);
    return declared === undefined
        ? `install ${tool.name}`
        : `${declared.command} ${tool.installers[declared.installer]!.name}`;
}

test.each([...OPERATING_SYSTEMS])(
    'a missing host XML reader reports $node acquisition guidance without requesting a managed install',
    async ({ node: platform }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], { tables: 'runner = "mise"\n' }),
        });
        using _environment = useEnvironment({
            PATH: join(sandbox.path, 'empty-bin'),
            MISE_DATA_DIR: join(sandbox.path, 'mise'),
        });
        using _host = usePlatform(platform);
        const tool = toolPin(configurationManifests().values(), 'xmllint');
        const hint = installerHint(tool, platform);
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
    },
);

test('doctor and a missing XML check report the host installation prerequisite', async () => {
    await using sandbox = await testdir();
    const root = join(sandbox.path, 'project');
    const binaries = join(sandbox.path, 'binaries');
    await mkdir(binaries);
    for (const name of ['git', 'node']) {
        const executable = Bun.which(name);
        expect(executable, `${name} is required for CLI metadata inspection.`).not.toBeNull();
        const windowsName = `${name}.exe`;
        const filename = process.platform === 'win32' ? windowsName : name;
        await symlink(executable!, join(binaries, filename));
    }
    await createFileTree(root, {
        'gspot.toml': buildPolicy([]),
        'document.xml': '<root />\n',
        'package.json': '{"private":true,"packageManager":"npm@10.9.0"}\n',
    });
    const hint = installerHint(toolPin(configurationManifests().values(), 'xmllint'), process.platform);
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
