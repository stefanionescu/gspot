import { chmod, copyFile, cp, mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { toolModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

test('javascript/biome checks shebang scripts, TypeScript, and component files in each scope, with the limits of the scope and the language', async () => {
    const nested = 'if (value) { if (value.ready) { if (value.id) return 1; } } return 0;';
    const typed = `function count(value: { ready: boolean; id: number }) { ${nested} }`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            tables:
                '[limits.javascript]\nmax_cognitive_complexity = 2\n[limits.typescript]\nmax_cognitive_complexity = 2\n' +
                '[[scope]]\npath = "app"\n[scope.limits.javascript]\nmax_cognitive_complexity = 8\n[scope.limits.typescript]\nmax_cognitive_complexity = 2\n',
        }),
        'bin/run': `#!/usr/bin/env node\nfunction count(value) { ${nested} }\n`,
        'source.ts': `export ${typed}\n`,
        'Widget.vue': `<script setup lang="ts">\n${typed}\n</script>\n`,
        'Widget.svelte': `<script lang="ts">\n${typed}\n</script>\n`,
        'Page.astro': `---\n${typed}\n---\n<p>Page</p>\n`,
        'app/source.ts': `export ${typed}\n`,
        'app/source.js': `export function count(value) { ${nested} }\n`,
    });
    const modules = join(sandbox.path, '.gspot/node_modules');
    const biome = await realpath(join(toolModules, '@biomejs/biome'));
    await cp(dirname(biome), join(modules, '@biomejs'), { recursive: true, dereference: true });
    await mkdir(join(modules, '.bin'));
    const launcher = join(modules, '.bin/biome');
    await copyFile(join(modules, '@biomejs/biome/bin/biome'), launcher);
    await chmod(launcher, 0o755);
    if (isWindows) await writeFile(`${launcher}.cmd`, `@"${process.execPath}" "%~dp0biome" %*\r\n`);
    await applyGeneratedFiles(sandbox.path);
    const findings = await runSandboxCheck(sandbox.path, 'javascript/biome');
    const nestedFindings = await runSandboxCheck(sandbox.path, 'javascript/biome', { scope: 'app' });
    expect([...findings, ...nestedFindings].map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
        [
            { file: 'Page.astro', line: 2 },
            { file: 'Widget.svelte', line: 2 },
            { file: 'Widget.vue', line: 2 },
            { file: 'source.ts', line: 1 },
            { file: 'bin/run', line: 2 },
            { file: 'app/source.ts', line: 1 },
        ].map((finding) => ({ ...finding, rule: 'lint/complexity/noExcessiveCognitiveComplexity' })),
    );
});
