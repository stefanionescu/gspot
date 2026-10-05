import { test, expect } from 'bun:test';
import { toolPin } from '#cli/tools/pins.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildBinaryPin } from '#tests/harness/pins.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import { inspectTool, toolAvailability } from '#cli/tools/inspect.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { NATIVE_HINTS, NATIVE_HINT_COMMANDS, PRIVATE_INSTALLATIONS } from '#tests/config/cli/tools/installation.ts';

test.each([...PRIVATE_INSTALLATIONS])(
    'the declared $name installer has the expected location and exact version',
    (entry) => {
        const tool = { ...buildBinaryPin(entry.tool, entry.version), installers: entry.installers };
        const placement = privateToolInstallation(tool, entry.runner);
        expect(
            placement === undefined ? undefined : { kind: placement.kind, version: placement.version },
        ).toStrictEqual(entry.expected);
    },
);

test.each(NATIVE_HINTS)('a missing native %s tool gives actionable guidance under %s', async (name, runner) => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy([], { tables: runner === 'mise' ? 'run_with = "mise"\n' : '' }),
    });
    const path = environmentVariables()['PATH'];
    setEnvironmentVariable('PATH', repository.path);
    try {
        const pin = toolPin(configurationManifests().values(), name);
        const inspection = inspectTool(
            { root: repository.path, inspections: new Map(), policyFiles: readPolicy(repository.path) },
            pin,
        );
        expect(inspection.state).toBe('missing');
        if (runner === 'mise') expect(inspection.hint).toBe('Run: gspot install');
        else {
            expect(inspection.hint).toContain(NATIVE_HINT_COMMANDS[process.platform]![name]);
            expect(inspection.hint).not.toContain('gspot install');
        }
        expect(toolAvailability(pin, inspection)).toStrictEqual({
            status: 'missing',
            note: `${name} ${pin.version ?? ''} is not installed. ${inspection.hint ?? ''}`,
        });
    } finally {
        setEnvironmentVariable('PATH', path);
    }
});
