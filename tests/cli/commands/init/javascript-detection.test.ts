import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { TOOLING_PACKAGE, NON_JAVASCRIPT_PROJECTS } from '#tests/config/cli/commands/init/selection.ts';

// The same public plan must select languages from sources while retaining package boundaries.
test.each(NON_JAVASCRIPT_PROJECTS)(
    '%s tooling packages preserve scopes and match the default and accepted initialization plans',
    async (language, file, source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': TOOLING_PACKAGE,
            'app/package.json': '{"name":"example-app","private":true}\n',
            [`app/${file}`]: source,
        });
        const before = readTree(sandbox.path);
        const argv = ['init', '--dry-run', ...QUIET_INIT];
        const preview = await spawnGspot(sandbox.path, argv);
        const accepted = await spawnGspot(sandbox.path, [...argv, '--yes']);
        for (const result of [preview, accepted]) {
            expect(result.code, `${language}: ${result.stdout}${result.stderr}`).toBe(0);
            expect(result.stdout).toContain('\nconfigurations\n');
            expect(result.stdout).not.toMatch(/^ {2}javascript\s/mu);
        }
        expect(preview.stdout.slice(preview.stdout.indexOf('\nconfigurations\n'))).toBe(
            accepted.stdout.slice(accepted.stdout.indexOf('\nconfigurations\n')),
        );
        const json = await spawnGspot(sandbox.path, [...argv, '--yes', '--json']);
        expect(json.code, json.stdout + json.stderr).toBe(0);
        const output = JSON.parse(json.stdout) as Required<Pick<InitJson, 'plan' | 'policy'>>;
        expect(output.plan.configurations.map(({ configuration }) => configuration)).not.toContain('javascript');
        expect(parseStrictPolicy(output.policy, sandbox.path).scopes.map(({ path }) => path)).toStrictEqual(['app']);
        expect(readTree(sandbox.path)).toStrictEqual(before);
        const written = await spawnGspot(sandbox.path, ['init', '--yes', '--json', ...QUIET_INIT]);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        expect(session.repository.scopes.map(({ path }) => path)).toStrictEqual(['', 'app']);
        expect(session.scopes.flatMap(({ view }) => view.configurations)).not.toContain('javascript');
    },
);

test.each(NON_JAVASCRIPT_PROJECTS)(
    '%s tooling packages include JavaScript tools only after a real Node source appears at either level',
    async (language, file, source) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': TOOLING_PACKAGE, [file]: source });
        const initialized = await spawnGspot(sandbox.path, ['init', '--yes', '--json', ...QUIET_INIT]);
        expect(initialized.code, `${language}: ${initialized.stdout}${initialized.stderr}`).toBe(0);
        for (const level of ['recommended', 'all']) {
            const selected = await spawnGspot(sandbox.path, ['set', 'level', level]);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const project = parseToolProject(await Bun.file(join(sandbox.path, '.gspot/package.json')).text());
            for (const name of ['eslint', 'knip', 'typescript', '@gspothq/eslint-plugin'])
                expect(Object.keys(project.dependencies)).not.toContain(name);
            expect(await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).exists()).toBe(false);
        }
        await Bun.write(join(sandbox.path, 'run'), '#!/usr/bin/env node\nconsole.log(1);\n');
        const discovered = await spawnGspot(sandbox.path, ['apply']);
        expect(discovered.code, discovered.stdout + discovered.stderr).toBe(0);
        for (const level of ['recommended', 'all']) {
            const applied = await spawnGspot(sandbox.path, ['set', 'level', level]);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const selected = await openSession(sandbox.path);
            expect(selected.scopes.flatMap(({ view }) => view.configurations)).toContain('javascript');
            const project = parseToolProject(await Bun.file(join(sandbox.path, '.gspot/package.json')).text());
            expect(Object.keys(project.dependencies)).toContain('eslint');
            expect(await Bun.file(join(sandbox.path, '.gspot/config/eslint.config.mjs')).exists()).toBe(true);
        }
    },
);
