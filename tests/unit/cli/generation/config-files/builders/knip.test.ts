import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { openSession } from '#cli/session.ts';
import { rm, writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { parseOutput } from '#cli/runs/output/formats.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { generateFile } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { type KnipConfigFile } from '#tests/types/generated-files.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/needed.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    HOST_MODULE,
    KNIP_ARGUMENTS,
    KNIP_ENTRY_TABLES,
    KNIP_UNUSED_FILES,
    KNIP_POINTER_FILES,
    KNIP_POINTER_TABLES,
    KNIP_WORKSPACE_FILES,
    KNIP_COMPONENT_FILES,
    KNIP_DEPENDENCY_PACKAGE,
} from '#tests/data/generation/config-files/builders/knip.ts';

const check = readConfigurations()
    .get('javascript')!
    .checks.find(({ id: name }) => name === 'javascript/knip')!;

test('Knip finds unused framework component files and uses the entry points of each scope', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['javascript'], { level: 'all', tables: KNIP_ENTRY_TABLES });
    const configuration = await generateFile(
        settings,
        '.gspot/configurations/language/javascript/knip.json',
        KNIP_COMPONENT_FILES,
    );
    await createFileTree(sandbox.path, {
        ...KNIP_COMPONENT_FILES,
        '.gspot/configurations/language/javascript/knip.json': configuration,
    });
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const result = await runCommand([...KNIP_ARGUMENTS, 'files'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
        KNIP_UNUSED_FILES.map((file) => ({
            check: check.id,
            file,
            rule: 'files',
            message: `Unused file: ${file}`,
            help: check.help,
            fixable: false,
        })),
    );
    for (const file of KNIP_UNUSED_FILES) await rm(join(sandbox.path, file));
    const corrected = await runCommand([...KNIP_ARGUMENTS, 'files'], { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([]);
});

test("Knip ignores gspot's tool packages and reports your unused dependencies", async () => {
    await using sandbox = await testdir();
    const files = { 'package.json': KNIP_DEPENDENCY_PACKAGE, 'main.js': 'export const value = 1;\n' };
    const configuration = await generateFile(
        buildSandboxSettings(['javascript'], { level: 'all' }),
        '.gspot/configurations/language/javascript/knip.json',
        files,
    );
    await createFileTree(sandbox.path, {
        ...files,
        '.gspot/configurations/language/javascript/knip.json': configuration,
    });
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const result = await runCommand([...KNIP_ARGUMENTS, 'dependencies'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings.toSorted((left, right) => left.message.localeCompare(right.message))).toStrictEqual([
        {
            check: check.id,
            file: 'package.json',
            rule: 'dependencies',
            message: 'Unused dependency: fixture-unused-package',
            help: check.help,
            fixable: false,
        },
        {
            check: check.id,
            file: 'package.json',
            rule: 'dependencies',
            message: 'Unused dependency: vale',
            help: check.help,
            fixable: false,
        },
    ]);
    await writeFile(join(sandbox.path, 'package.json'), '{"name":"native-project","private":true,"type":"module"}');
    const corrected = await runCommand([...KNIP_ARGUMENTS, 'dependencies'], { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([]);
});

test("Knip ignores gspot's pointer files and reports other configuration-like files", async () => {
    await using sandbox = await testdir({
        ...KNIP_POINTER_FILES,
        'gspot.toml': buildSandboxSettings(['javascript', 'markdown'], { level: 'all', tables: KNIP_POINTER_TABLES }),
    });

    const session = await openSession(sandbox.path);
    const generated = generate(session).files;
    const pointers = generated.filter(({ path }) =>
        ['eslint.config.mjs', 'prettier.config.mjs', '.markdownlint.jsonc'].includes(basename(path)),
    );
    const configuration = generated.find(({ path }) => path === '.gspot/configurations/language/javascript/knip.json')!;
    expect(pointers.some((pointer) => pointer.path === 'eslint.config.mjs')).toBe(true);
    const markdown = session.configurations
        .get('markdown')!
        .configFiles.find(({ tool }) => tool.includes('markdownlint-cli2'))!;
    expect(getConfigFileTarget('child', markdown, getConfigFiles(session).targets)).toBe(markdown.target);
    await createFileTree(
        sandbox.path,
        Object.fromEntries([configuration, ...pointers].map(({ path, content }) => [path, content])),
    );
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const result = await runCommand([...KNIP_ARGUMENTS, 'files'], { cwd: sandbox.path });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path })
            .map(({ file }) => file)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['child/eslint.config.js', 'eslint.config.js']);
});

test("Knip gets each scope's test_files as entry points without sibling leaks", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: 'test_files = ["specifications/**"]\n[[scope]]\npath = "app"\n\ntest_files = ["app/verification/**"]\n[[scope]]\npath = "app/deep"\n\ntest_files = []\n[[scope]]\npath = "sibling"\n\ntest_files = ["sibling/sibling-tests/**"]\n',
        }),
        'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
        'source.js': 'export {};\n',
        'app/package.json': '{"private":true}',
        'app/deep/package.json': '{"private":true}',
        'sibling/package.json': '{"private":true}',
    });

    const session = await openSession(sandbox.path);
    const content = generate(session).files.find(
        ({ path }) => path === '.gspot/configurations/language/javascript/knip.json',
    )!.content;
    const { workspaces } = JSON.parse(content) as KnipConfigFile;
    expect(workspaces['.']!.entry).toContain('specifications/**');
    expect(workspaces['app']!.entry).toContain('verification/**');
    expect(workspaces['app']!.entry).not.toContain('app/verification/**');
    expect(workspaces['app']!.entry).not.toContain('sibling-tests/**');
    expect(workspaces['sibling']!.entry).toContain('sibling-tests/**');
    expect(workspaces['app/deep']!.entry).not.toContain('verification/**');
    expect(workspaces['app/deep']!.entry).toContain('**/*.test.*');
    for (const { settings } of session.scopes) expect(settings.test_files).toContain('specifications/**');
});

test('Knip workspaces come from package workspaces, your entries and the configuration entry files', async () => {
    const files = KNIP_WORKSPACE_FILES;
    const settings = buildSandboxSettings(['javascript'], {
        tables: '[tools.knip]\nentry = ["cli.js"]\n[[scope]]\npath = "api"\n\nconfigurations = ["javascript"]\n[scope.tools.knip]\nentry = ["api/serve.js"]\n[[scope]]\npath = "lib"\n\nconfigurations = ["javascript"]\n',
    });
    const knip = JSON.parse(
        await generateFile(settings, '.gspot/configurations/language/javascript/knip.json', files),
    ) as KnipConfigFile;
    expect(knip.workspaces['.']!.entry).toStrictEqual(matchItems(['cli.js', 'src/main.{ts,js}']));
    expect(knip.workspaces['.']!.entry).not.toContain('api/serve.js');
    expect(knip.workspaces['api']?.entry).toStrictEqual(matchItems(['serve.js', 'src/main.{ts,js}']));
    expect(knip.workspaces['api']?.entry).not.toContain('cli.js');
    // A package outside every scope takes the root configurations; scopes without packages stay out.
    expect(knip.workspaces['web']?.entry).toStrictEqual(matchItems(['src/main.{ts,js}']));
    expect(Object.keys(knip.workspaces)).not.toContain('lib');
    const withoutEntries = JSON.parse(
        await generateFile(
            buildSandboxSettings(['javascript']),
            '.gspot/configurations/language/javascript/knip.json',
            files,
        ),
    ) as KnipConfigFile;
    expect(withoutEntries.workspaces['.']!.entry).toStrictEqual(matchItems(['src/main.{ts,js}']));
    expect(withoutEntries.workspaces['.']!.entry).not.toContain('cli.js');
});

test('Knip keeps a declared package that a mise file task runs through a package runner', async () => {
    const knip = JSON.parse(
        await generateFile(
            buildSandboxSettings(['javascript']),
            '.gspot/configurations/language/javascript/knip.json',
            {
                'package.json': JSON.stringify({
                    private: true,
                    devDependencies: { wrangler: '4.0.0', 'left-pad': '1.3.0' },
                }),
                'main.js': 'export const value = 1;\n',
                '.mise/tasks/deploy': '#!/usr/bin/env bash\nbunx wrangler@4 deploy\n',
                'mise-tasks/typecheck': '#!/usr/bin/env bash\nnpx --yes undeclared-tool\n',
            },
        ),
    ) as { ignoreDependencies: string[] };
    expect(knip.ignoreDependencies).toContain('wrangler');
    expect(knip.ignoreDependencies).not.toContain('left-pad');
    expect(knip.ignoreDependencies).not.toContain('undeclared-tool');
});
test('javascript.externals reach the Knip unresolved imports', async () => {
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: `[javascript]\nexternals = ["${HOST_MODULE}"]\n`,
    });
    const files = { 'package.json': '{"private":true,"type":"module"}\n', 'web/src/a.js': '' };
    const knip = JSON.parse(
        await generateFile(settings, '.gspot/configurations/language/javascript/knip.json', files),
    ) as {
        ignoreUnresolved?: string[];
    };
    expect(knip.ignoreUnresolved).toStrictEqual([HOST_MODULE]);
});
