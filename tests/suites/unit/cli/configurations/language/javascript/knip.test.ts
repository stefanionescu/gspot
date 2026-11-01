import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { join, basename } from 'node:path';
import { rm, writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { KnipConfig } from '#tests/types/configurations.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

import {
    KNIP_ARGUMENTS,
    KNIP_LINK_FILES,
    KNIP_UNUSED_FILES,
    KNIP_WORKSPACE_FILES,
    KNIP_COMPONENT_FILES,
} from '#tests/config/configurations/javascript/checks.ts';

const knipArguments = [...KNIP_ARGUMENTS, '--config', getManifestTarget('javascript', 'knip.json'), '--include'];

const check = readConfigurations()
    .get('javascript')!
    .checks.find(({ id: name }) => name === 'javascript/knip')!;

test('Knip finds unused framework component files and uses the entry points of each scope', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: `\ntest_files = ["native-tests/**"]\n[javascript]\nentry_files = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript"]\ntest_files = ["verification/**"]\n[scope.javascript]\nentry_files = ["main.js"]\n`,
    });
    const configuration = await buildGeneratedFile(
        settings,
        getManifestTarget('javascript', 'knip.json'),
        KNIP_COMPONENT_FILES,
    );
    await createFileTree(sandbox.path, {
        ...KNIP_COMPONENT_FILES,
        [getManifestTarget('javascript', 'knip.json')]: configuration,
    });
    await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
    const result = await runCommand([...knipArguments, 'files'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(
        findings
            .map(({ file, rule }) => ({ file, rule }))
            .toSorted((left, right) => compareText(left.file, right.file)),
    ).toStrictEqual(
        KNIP_UNUSED_FILES.map((file) => ({
            file,
            rule: 'files',
        })),
    );
    for (const file of KNIP_UNUSED_FILES) await rm(join(sandbox.path, file));
    const corrected = await runCommand([...knipArguments, 'files'], { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([]);
});

test("Knip ignores gspot's tool packages and reports your unused dependencies", async () => {
    await using sandbox = await createGitSandbox({});
    const files = {
        'package.json':
            '{"name":"native-project","private":true,"type":"module","dependencies":{"vale":"0.0.0","sample-unused-package":"1.0.0","prettier":"0.0.0-test","eslint-config-prettier":"0.0.0-test","@gspothq/eslint-plugin":"0.0.0"}}',
        'main.js': 'export const value = 1;\n',
    };
    const configuration = await buildGeneratedFile(
        buildSandboxSettings(['javascript'], { level: 'all' }),
        getManifestTarget('javascript', 'knip.json'),
        files,
    );
    await createFileTree(sandbox.path, {
        ...files,
        [getManifestTarget('javascript', 'knip.json')]: configuration,
    });
    await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
    const result = await runCommand([...knipArguments, 'dependencies'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        {
            file: 'package.json',
            rule: 'dependencies',
        },
        {
            file: 'package.json',
            rule: 'dependencies',
        },
    ]);
    await writeFile(join(sandbox.path, 'package.json'), '{"name":"native-project","private":true,"type":"module"}');
    const corrected = await runCommand([...knipArguments, 'dependencies'], { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([]);
});

test('Knip treats script configuration files as entries and ignores link files', async () => {
    await using sandbox = await createGitSandbox({
        ...KNIP_LINK_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'markdown'], {
            level: 'all',
            tables: `\n[javascript]\nentry_files = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript", "markdown"]\n[scope.javascript]\nentry_files = ["main.js"]\n`,
        }),
    });

    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session).files;
    const linkFiles = generated.filter(({ path }) =>
        ['eslint.config.mjs', 'prettier.config.mjs', '.markdownlint.jsonc'].includes(basename(path)),
    );
    const configuration = generated.find(({ path }) => path === getManifestTarget('javascript', 'knip.json'))!;
    await createFileTree(
        sandbox.path,
        Object.fromEntries([configuration, ...linkFiles].map(({ path, content }) => [path, content])),
    );
    await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
    await writeFile(join(sandbox.path, 'unused.js'), 'export const unused = 1;\n');
    const result = await runCommand([...knipArguments, 'files'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path }).map(
            ({ file, rule }) => ({ file, rule }),
        ),
    ).toStrictEqual([
        {
            file: 'unused.js',
            rule: 'files',
        },
    ]);
});

test("Knip gets each scope's test_files as entry points without sibling leaks", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: 'test_files = ["specifications/**"]\n[[scope]]\npath = "app"\n\ntest_files = ["verification/**"]\n[[scope]]\npath = "app/deep"\n\ntest_files = []\n[[scope]]\npath = "sibling"\n\ntest_files = ["sibling-tests/**"]\n',
        }),
        'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
        'source.js': 'export {};\n',
        'app/package.json': '{"private":true}',
        'app/deep/package.json': '{"private":true}',
        'sibling/package.json': '{"private":true}',
    });

    const session = await openSession(sandbox.path);
    const content = buildGeneratedFiles(session).files.find(
        ({ path }) => path === getManifestTarget('javascript', 'knip.json'),
    )!.content;
    const { workspaces } = JSON.parse(content) as KnipConfig;
    const testGlobs = new Set(['**/tests/**', 'specifications/**', 'verification/**', 'sibling-tests/**']);
    expect(
        Object.fromEntries(
            Object.entries(workspaces).map(([name, { entry }]) => [name, entry.filter((glob) => testGlobs.has(glob))]),
        ),
    ).toStrictEqual({
        '.': ['specifications/**'],
        app: ['verification/**'],
        'app/deep': [],
        sibling: ['sibling-tests/**'],
    });
});

test('Knip workspaces come from package workspaces, your entries and the configuration entry files', async () => {
    const files = KNIP_WORKSPACE_FILES;
    const settings = buildSandboxSettings(['javascript'], {
        tables: '[javascript]\nentry_files = ["cli.js"]\n[[scope]]\npath = "api"\n\nconfigurations = ["javascript"]\n[scope.javascript]\nentry_files = ["serve.js"]\n[[scope]]\npath = "lib"\n\nconfigurations = ["javascript"]\n',
    });
    const knip = JSON.parse(
        await buildGeneratedFile(settings, getManifestTarget('javascript', 'knip.json'), files),
    ) as KnipConfig;
    const namedFiles = new Set(['cli.js', 'serve.js', 'eslint.config.mjs']);
    expect(
        Object.fromEntries(
            Object.entries(knip.workspaces).map(([name, { entry }]) => [
                name,
                entry.filter((glob) => namedFiles.has(glob)),
            ]),
        ),
    ).toStrictEqual({ '.': ['cli.js', 'eslint.config.mjs'], api: ['serve.js'], web: [] });
});

test('Knip keeps a declared package that a mise file task runs through a package runner', async () => {
    const knip = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['javascript']), getManifestTarget('javascript', 'knip.json'), {
            'package.json': JSON.stringify({
                private: true,
                devDependencies: { wrangler: '4.0.0', 'left-pad': '1.3.0' },
            }),
            'main.js': 'export const value = 1;\n',
            '.mise/tasks/deploy':
                '#!/usr/bin/env bash\n# npx left-pad\necho "#" issue#4; bunx wrangler@4 deploy # npx left-pad\n',
            'mise-tasks/typecheck': '#!/usr/bin/env bash\nnpx --yes undeclared-tool\n',
        }),
    ) as { ignoreDependencies: string[] };
    expect(knip.ignoreDependencies).toContain('wrangler');
    expect(knip.ignoreDependencies).not.toContain('left-pad');
    expect(knip.ignoreDependencies).not.toContain('undeclared-tool');
});

test('Knip treats script patterns and the ESLint import chain as used entries', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"type":"module"}',
        'scripts/check-notes.mjs': 'console.log("checked");\n',
        'tools/lint/plugin.mjs': EMPTY_DEFAULT_SOURCE,
        'eslint.config.mjs': 'import plugin from "./tools/lint/plugin.mjs"; export default [plugin];\n',
    });
    const content = buildGeneratedFiles(await openSession(sandbox.path)).files.find(
        ({ path }) => path === getManifestTarget('javascript', 'knip.json'),
    )!;
    await createFileTree(sandbox.path, { [content.path]: content.content });
    await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
    const result = await runCommand([...knipArguments, 'files'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(0);
});
