import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { listCodeFences } from '#cli/parsers/formats/markdown.ts';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

const installedSandbox = shareInstalledSandbox({
    configurations: ['python'],
    level: 'all',
    files: { 'example.py': '"""A shipped example."""\n' },
});

test('shipped Python examples pass Ruff formatting and the generated lint rules', async () => {
    const { root } = installedSandbox();
    const program = buildVenvExecutablePath(join(root, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const configuration = join(root, getManifestTarget('python', 'ruff.toml'));
    const paths = listAssets('configurations/').filter((path) => path.includes('/rules/') && path.endsWith('.md'));
    const groupedExamples = await Promise.all(
        paths.map(async (path) => {
            const fences = listCodeFences(await readFile(buildAssetPath(path), 'utf8'));
            return fences.filter(({ language }) => language === 'python').map((fence) => ({ path, ...fence }));
        }),
    );
    const examples = groupedExamples.flat();
    const failures: { path: string; line: number; command: string; output: string }[] = [];
    const commands = [
        ['format', '--check'],
        ['check', '--ignore', 'F821,D100,INP001'],
    ];
    for (const example of examples) {
        const sample = join(root, 'example.py');
        await writeFile(sample, `${example.body}\n`);
        for (const command of commands) {
            const result = await runCommand([program, ...command, '--config', configuration, sample], { cwd: root });
            if (result.code !== 0)
                failures.push({
                    path: example.path,
                    line: example.startLine,
                    command: command.join(' '),
                    output: result.stdout + result.stderr,
                });
        }
    }
    expect(examples.length).toBeGreaterThan(0);
    expect(failures).toStrictEqual([]);
});
