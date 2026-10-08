import { test, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildBinaryPin } from '#tests/harness/pins.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
import { inspectTool, toolAvailability } from '#cli/tools/inspect.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { toolPin, toolProjectPackage } from '#cli/configurations/pins.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import { NATIVE_HINTS, TOOL_PROJECT_PACKAGES } from '#tests/config/cli/configurations/pins.ts';

test.each([...TOOL_PROJECT_PACKAGES])(
    'the declared $name installer has the expected location and exact version',
    (entry) => {
        const tool = { ...buildBinaryPin(entry.tool, entry.version), installers: entry.installers };
        const placement = toolProjectPackage(tool, entry.runner);
        expect(
            placement === undefined ? undefined : { kind: placement.kind, version: placement.version },
        ).toStrictEqual(entry.expected);
    },
);

test.each(NATIVE_HINTS)('a missing native %s tool gives actionable guidance under %s', async (name, runner) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy([], { tables: runner === 'mise' ? 'runner = "mise"\n' : '' }),
    });
    using _environment = useEnvironment({ PATH: repository.path });
    const pin = toolPin(configurationManifests().values(), name);
    const inspection = inspectTool(
        { root: repository.path, inspections: new Map(), policyFiles: readPolicy(repository.path) },
        pin,
    );
    expect(inspection.state).toBe('missing');
    if (runner === 'mise') expect(inspection.hint).toBe('Run: gspot install');
    else {
        const host = OPERATING_SYSTEMS.find(({ node }) => node === process.platform)!;
        const installer = host.installers.find(({ installer }) => pin.installers[installer] !== undefined);
        expect(inspection.hint).toContain(
            installer === undefined
                ? `mise install ${pin.installers['mise']!.name}@`
                : `${installer.command} ${pin.installers[installer.installer]!.name}`,
        );
        expect(inspection.hint).not.toContain('gspot install');
    }
    expect(toolAvailability(pin, inspection)).toStrictEqual({
        status: 'missing',
        note: `${name} ${pin.version ?? ''} is not installed. ${inspection.hint ?? ''}`,
    });
});
