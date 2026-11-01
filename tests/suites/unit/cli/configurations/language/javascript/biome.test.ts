import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

test.each(['', 'app'])('Biome applies language limits in scope "%s" without enabling other rules', async (scope) => {
    const prefix = scope === '' ? '' : `${scope}/`;
    const source = 'function count(value) { if (value) { if (value.ready) { if (value.id) return 1; } } return 0; }';
    const paths = ['source.js', 'source.ts', 'Page.astro', 'View.vue', 'View.svelte'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            level: 'all',
            tables:
                '[limits.javascript]\nmax_cognitive_complexity = 2\n[limits.typescript]\nmax_cognitive_complexity = 8\n' +
                '[[scope]]\npath = "app"\n[scope.limits.javascript]\nmax_cognitive_complexity = 8\n[scope.limits.typescript]\nmax_cognitive_complexity = 2\n',
        }),
        [`${prefix}source.js`]: source,
        [`${prefix}source.ts`]: source,
        [`${prefix}Page.astro`]: `---\n${source}\n---\n<p>Example</p>`,
        [`${prefix}View.vue`]: `<script lang="ts">${source}</script><template><p>Example</p></template>`,
        [`${prefix}View.svelte`]: `<script lang="ts">${source}</script><p>Example</p>`,
    });
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const config = getConfigPath(session, 'biome', scope);
    const result = await runCommand(
        [
            join(sandbox.path, '.gspot/node_modules/.bin/biome'),
            'lint',
            '--config-path',
            config,
            '--reporter=rdjson',
            ...paths.map((path) => prefix + path),
        ],
        { cwd: sandbox.path },
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const check = readConfigurations()
        .get('javascript')!
        .checks.find(({ id }) => id === 'javascript/biome')!;
    const findings = parseOutput(check, result.stdout, result.stderr, { root: sandbox.path, cwd: sandbox.path });
    expect(findings.map(({ file }) => file).toSorted(compareText)).toStrictEqual(
        (scope === '' ? ['source.js'] : paths.slice(1).map((path) => prefix + path)).toSorted(compareText),
    );
    expect(
        findings.every(
            ({ rule, message }) =>
                rule === 'lint/complexity/noExcessiveCognitiveComplexity' && message.includes('(max: 2)'),
        ),
    ).toBe(true);
});
