import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/inspect.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { rejection } from '#tests/support/expectations.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { createPackageProject } from '#tests/support/cli/package-project.ts';
import { PACKAGE_PROJECTS } from '#tests/constants/integration/tools/packages.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s retains edited installed files and refreshes inspection after correction',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root } = fixture;
        const tools = [...configurationManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        await installPackageProject(root, tools);
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = readFileSync(readmePath);
        writeFileSync(readmePath, 'authored later');
        expect(await rejection(installPackageProject(root, tools))).toContain('Preserved edited');
        expect(readFileSync(join(root, '.gspot/node_modules/prettier/README.md'), 'utf8')).toBe('authored later');
        const context = { root, inspections: new Map() };
        const pin = {
            name: 'prettier',
            version: '3.8.1',
            installers: { npm: { name: 'prettier', version: '3.8.1' } },
        };
        expect(inspectTool(context, pin)).toMatchObject({
            state: 'error',
            note: 'Tool installation is incomplete. Run: gspot install',
        });
        writeFileSync(readmePath, readme);
        await installPackageProject(root, tools);
        expect(inspectTool(context, pin).state).toBe('ok');
    },
    120_000,
);
