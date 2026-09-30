import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { inspectTool } from '#cli/tools/inspect.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { installPackageProject } from '#cli/tools/packages/project.ts';
import { createPackageProject } from '#tests/support/cli/package-project.ts';
import { PACKAGE_PROJECTS } from '#tests/inputs/integration/tools/packages.ts';

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s replaces an edited installed file with the locked one and keeps the tool usable',
    async (client, projectPath, runner) => {
        await using fixture = await createPackageProject(client, projectPath, runner);
        const { root } = fixture;
        const tools = [...kitManifests().values()].flatMap((manifest) => manifest.tools);
        const first = await applyAll(await openSession(root));
        expect(first.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        await installPackageProject(root, tools);
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = readFileSync(readmePath);
        writeFileSync(readmePath, 'authored later');
        await installPackageProject(root, tools);
        expect(readFileSync(readmePath)).toStrictEqual(readme);
        const pin = {
            name: 'prettier',
            version: '3.8.1',
            installers: { npm: { name: 'prettier', version: '3.8.1' } },
        };
        expect(inspectTool({ root, inspections: new Map() }, pin).state).toBe('ok');
    },
    120_000,
);
