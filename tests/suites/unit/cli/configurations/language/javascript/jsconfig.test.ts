import { dirname, join, resolve } from 'node:path';

import { expect, test } from 'bun:test';
import ts from 'typescript';

import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { compareText } from '#cli/system/text.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test('a jsconfig beside a tsconfig keeps authored exclusions and lists only tracked declaration files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript']),
        '.gitignore': '.next/\n.open-next/\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"],"exclude":["vendor"]}',
        'src/main.ts': 'export const value = 1;\n',
        'worker.js': 'export const worker = 1;\n',
        'cloudflare-env.d.ts': 'declare const env: string;\n',
        '.next/types/routes.d.ts': 'declare const routes: string;\n',
        '.open-next/worker.js': 'export const bundle = 1;\n',
    });

    runGitStep(sandbox.path, [
        'add',
        '--',
        '.gitignore',
        'tsconfig.json',
        'src/main.ts',
        'worker.js',
        'cloudflare-env.d.ts',
    ]);
    const files = buildGeneratedFiles(await openSession(sandbox.path)).files;
    const jsconfig = JSON.parse(
        files.find(({ path }) => path === getManifestTarget('javascript', 'jsconfig.json'))!.content,
    ) as { files: string[]; exclude: string[] };
    expect(jsconfig.files).toStrictEqual(['../../../../cloudflare-env.d.ts']);
    expect(jsconfig.exclude).toContain('../../../../vendor');
    expect(jsconfig.exclude).toContain(`../../../../${GSPOT_FOLDER}/**`);
});

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

test.each(['all'] as const)('JavaScript implicit parameters follow level %s', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'source.js':
            'export function total(items) { return items.length; }\n/** @type {number} */\nexport const count = "one";\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const project = readTsconfig(
        sandbox.path,
        join(sandbox.path, getManifestTarget('javascript', 'jsconfig.json')),
        session.cache,
    )!;
    const program = ts.createProgram(project.fileNames, { ...project.options, noLib: true });
    const errorCodes = new Set(program.getSemanticDiagnostics().map(({ code }) => code));
    expect(errorCodes.has(7006)).toBe(true);
    expect(errorCodes.has(2322)).toBe(true);
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
    expect(excluded).not.toContain(resolve('tests/.gspot/**'));
    expect(excluded).not.toContain(resolve('docs/**'));
});
