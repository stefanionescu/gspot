import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { findMissingBuild, findPackagePin, listNpmProjectPins, listPackagePins } from '#cli/tools/pins.ts';
import { buildToolProjects } from '#cli/tools/projects.ts';
import type { Session } from '#cli/types/tools.ts';
import { TOOL_PROJECT_PACKAGES, TYPESCRIPT_PIN_CASES } from '#tests/config/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramPin } from '#tests/setup/cli/tools.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

function readToolDependencies(session: Session): Record<string, string> | undefined {
    const project = buildToolProjects(session).find(({ path }) => path === GSPOT_PATHS.npmProject)!;
    return packageJsonSchema.parse(JSON.parse(project.content)).devDependencies;
}

test.each([...TOOL_PROJECT_PACKAGES])('$name: the installers give the expected tool project package', (row) => {
    const tool = { ...buildProgramPin(row.tool, row.version), system: row.system, installers: row.installers };
    const placement = findPackagePin(tool);
    expect(placement).toStrictEqual(row.expected);
});

test('missing tool builds name the operating system and allow unrestricted tools', () => {
    const tool = buildProgramPin('example', '0.0.0-test');
    const host = { platform: 'macos', arch: 'arm64' } as const;
    expect(findMissingBuild({ ...tool, builds: ['linux'] }, host)).toBe('macOS');
    expect(findMissingBuild(tool, host)).toBeUndefined();
});

test('two plugin records that name one package at two versions are refused', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], {
            tables: '[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "1.0.0"\nrules = {}\n[[scope]]\npath = "app"\nconfigurations = []\n[[scope.tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "2.0.0"\nrules = {}\n',
        }),
        'app/a.css': 'a { color: red; }\n',
    });
    const session = await openSession(sandbox.path);
    expect(() => listNpmProjectPins(session)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('stylelint-acme') as string,
        }),
    );
});

test('a plugin package joins the tool project at its pin, and a tracked plugin module does not', async () => {
    const files = {
        'package.json': '{"private":true,"type":"module"}\n',
        'plugin.mjs': 'export default { rules: {} };\n',
        'a.css': 'a { color: blue; }\n',
    };
    await using plain = await createGitSandbox({ ...files, 'gspot.toml': buildSandboxSettings(['css', 'javascript']) });
    await using sandbox = await createGitSandbox({
        ...files,
        'gspot.toml': buildSandboxSettings(['css', 'javascript'], {
            tables: '[[tools.eslint.plugins]]\nname = "acme"\npackage = "eslint-plugin-acme"\nversion = "1.2.3"\nrules = { no-legacy = [] }\n[[tools.eslint.plugins]]\nname = "local"\npath = "plugin.mjs"\nrules = {}\n[[tools.stylelint.plugins]]\npackage = "stylelint-acme"\nversion = "4.5.6"\nrules = { "acme/no-red" = true }\n',
        }),
    });
    expect(readToolDependencies(await openSession(sandbox.path))).toStrictEqual({
        ...readToolDependencies(await openSession(plain.path)),
        'eslint-plugin-acme': '1.2.3',
        'stylelint-acme': '4.5.6',
    });
});

test('Next ESLint plugin keeps its shipped pin when two folders declare different majors and a node_modules/next 17.0.0 sits outside the root', async () => {
    await using sandbox = await testdir({
        'project/gspot.toml': buildSandboxSettings(['nextjs'], {
            scopes: [{ path: 'app/client', configurations: ['nextjs'] }],
        }),
        'project/package.json': '{"private":true,"dependencies":{"next":"^16.3.6"}}',
        'project/app/package.json': '{"private":true,"dependencies":{"next":"^15.5.9"}}',
        'project/app/client/source.ts': 'export const count = 1;\n',
        'node_modules/next/package.json': '{"name":"next","version":"17.0.0"}',
    });

    runGitStep(join(sandbox.path, 'project'), ['init', '--quiet']);
    const session = await openSession(join(sandbox.path, 'project'));
    expect(readToolDependencies(session)?.['@next/eslint-plugin-next']).toBe(
        getTool(readConfigurations().values(), '@next/eslint-plugin-next').version,
    );
});

test.each([...TYPESCRIPT_PIN_CASES])(
    'the tool project pins the TypeScript of the project for $name: $isProjectPin',
    async ({ files, untracked, isProjectPin }) => {
        await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': buildSandboxSettings(['typescript']) });
        const tracked = ['gspot.toml', ...Object.keys(files)].filter(
            (path) => !(untracked as readonly string[]).includes(path),
        );
        runGitStep(sandbox.path, ['add', '--', ...tracked]);
        const session = await openSession(sandbox.path);
        const expected = isProjectPin ? '6.0.3' : getTool(readConfigurations().values(), 'tsc').version;
        expect(listPackagePins(session.toolConfigurations).npm['typescript']).toBe(expected);
        const [planned] = planChecks(session, { stage: 'push', only: ['typescript/tsc'] });
        expect(planned?.tool?.version).toBe(expected);
    },
);
