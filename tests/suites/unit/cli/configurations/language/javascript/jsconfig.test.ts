import { dirname, join, resolve } from 'node:path';

import { expect, test } from 'bun:test';
import ts from 'typescript';

import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { compareText } from '#cli/system/text.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    ['checks JavaScript', '"allowJs":true,"checkJs":true', ['lib/command.js']],
    ['checks only TypeScript', '"strict":true', ['lib/command.js', 'tests/command.test.js']],
])('a tsconfig that %s gives the JavaScript files of its include or all of them', async (_name, options, expected) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript']),
        'tsconfig.json': `{"compilerOptions":{${options}},"include":["lib/**/*.js","lib/**/*.ts"]}`,
        'lib/command.js': 'export const command = 1;\n',
        'tests/command.test.js': 'export const tested = 1;\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const jsconfig = join(sandbox.path, getManifestTarget('javascript', 'jsconfig.json'));
    const host = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined };
    const fileNames = ts.getParsedCommandLineOfConfigFile(jsconfig, {}, host)?.fileNames ?? [];
    const scripts = fileNames.map((path) => path.slice(sandbox.path.length + 1)).filter((path) => path.endsWith('.js'));
    expect(scripts.toSorted(compareText)).toStrictEqual(expected);
});

test('a scoped jsconfig anchors recursive excludes in its scope and other excludes at the repository root', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'tests' }],
            tables: '[[ignore]]\npaths = ["docs/**", "tests/fixtures/**", "**/cache/**"]\nreason = "These folders hold reference files."\n',
        }),
        'tests/source.js': 'export const value = 1;\n',
    });
    const output = buildGeneratedFiles(await openSession(sandbox.path));
    const file = output.files.find(({ path }) => path.endsWith('/scopes/tests/jsconfig.json'))!;
    const config = JSON.parse(file.content) as { exclude: string[] };
    const excluded = config.exclude.map((path) => resolve(dirname(file.path), path));
    expect(excluded).toContain(resolve('tests/fixtures/**'));
    expect(excluded).toContain(resolve('tests/**/cache/**'));
    expect(excluded).not.toContain(resolve('tests/docs/**'));
    expect(excluded).not.toContain(resolve('docs/**'));
});

test('the extensionless import options reach only the scope that holds JavaScript', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'web' }],
            tables: '[javascript]\nimport_extension = "extensionless"\n',
        }),
        'web/source.js': 'export const value = 1;\n',
    });
    const output = buildGeneratedFiles(await openSession(sandbox.path));
    const selected = ['/scopes/web/jsconfig.json', getManifestTarget('javascript', 'jsconfig.json')].map((path) => {
        const file = output.files.find((each) => each.path.endsWith(path))!;
        const config = JSON.parse(file.content) as { compilerOptions: { moduleResolution: string } };
        return config.compilerOptions.moduleResolution;
    });
    expect(selected).toStrictEqual(['Bundler', 'NodeNext']);
});
