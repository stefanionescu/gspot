import ts from 'typescript';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, dirname, resolve } from 'node:path';
import { openSession } from '#cli/planning/session.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { readTsconfig } from '#cli/parsers/projects/tsconfig.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
    const files = generateFiles(await openSession(sandbox.path)).files;
    const jsconfig = JSON.parse(
        files.find(({ path }) => path === getManifestTarget('javascript', 'jsconfig.json'))!.content,
    ) as { files: string[]; exclude: string[] };
    expect(jsconfig.files).toStrictEqual(['../../../../cloudflare-env.d.ts']);
    expect(jsconfig.exclude).toContain('../../../../vendor');
    expect(jsconfig.exclude).toContain(`../../../../${GSPOT_FOLDER}/**`);
});

test.each(['basic', 'all'] as const)('JavaScript implicit parameters follow level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'source.js':
            'export function total(items) { return items.length; }\n/** @type {number} */\nexport const count = "one";\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const project = readTsconfig(
        sandbox.path,
        join(sandbox.path, getManifestTarget('javascript', 'jsconfig.json')),
        session.reads,
    )!;
    const program = ts.createProgram(project.fileNames, { ...project.options, noLib: true });
    const errorCodes = new Set(program.getSemanticDiagnostics().map(({ code }) => code));
    expect(errorCodes.has(7006)).toBe(level === 'all');
    expect(errorCodes.has(2322)).toBe(true);
});

test('a scoped jsconfig anchors recursive excludes in its scope and other excludes at the repository root', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'tests' }],
            tables: '[[ignore]]\npaths = ["docs/**", "tests/fixtures/**", "**/cache/**"]\nreason = "These folders hold reference files."\n',
        }),
        'tests/source.js': 'export const value = 1;\n',
    });
    const output = generateFiles(await openSession(sandbox.path));
    const file = output.files.find(({ path }) => path.endsWith('/scopes/tests/jsconfig.json'))!;
    const config = JSON.parse(file.content) as { exclude: string[] };
    const excluded = config.exclude.map((path) => resolve(dirname(file.path), path));
    expect(excluded).toContain(resolve('tests/fixtures/**'));
    expect(excluded).toContain(resolve('tests/**/cache/**'));
    expect(excluded).not.toContain(resolve('tests/docs/**'));
    expect(excluded).not.toContain(resolve('tests/.gspot/**'));
    expect(excluded).not.toContain(resolve('docs/**'));
});
