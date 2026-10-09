import { test, expect } from 'bun:test';
import { mkdir, symlink } from 'node:fs/promises';
import { readPolicy } from '#cli/policy/public.ts';
import { inspectTool } from '#cli/tools/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { usePlatform } from '#tests/harness/platforms.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { containing } from '#tests/harness/expectations.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
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
    'a missing host XML reader reports $node installation guidance without requesting a managed install',
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
        if (name === 'git' && process.platform === 'win32') continue;
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
    const environment = {
        PATH: [binaries, ...(process.platform === 'win32' ? [dirname(Bun.which('git')!)] : [])].join(delimiter),
        MISE_DATA_DIR: join(sandbox.path, 'mise'),
    };
    const doctor = await runGspot(root, ['doctor', '--json'], environment);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools).toContainEqual(
        containing({ name: 'xmllint', state: 'missing', hint }),
    );
    const checked = await checkReport(
        root,
        ['check', 'document.xml', '--only', 'files/xmllint', '--json'],
        environment,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks).toMatchObject([
        { check: 'files/xmllint', status: 'missing', findings: [], note: `xmllint is not installed. ${hint}` },
    ]);
});
