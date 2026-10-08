import { join } from 'node:path';
import stylelint from 'stylelint';
import type { Config } from 'stylelint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';
import { getSuggestions } from '#cli/commands/doctor/contracts.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { STYLELINT_SCOPES, STYLELINT_PROJECT, STYLELINT_SUGGESTIONS } from '#tests/config/cli/generation/stylelint.ts';

test.each(['recommended', 'all'] as const)(
    'Stylelint at %s keeps package fields with their applicable scope and restores them when CSS leaves',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['css'], { level, tables: STYLELINT_SCOPES });
        await createFileTree(sandbox.path, { ...STYLELINT_PROJECT, 'gspot.toml': policy });
        let session = await openSession(sandbox.path);
        const generated = emitAll(session);
        expect(generated.toolFiles).toStrictEqual([
            { path: 'package.json', changes: [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }] },
            { path: 'app/package.json', changes: [{ path: ['stylelint'], value: { extends: './.stylelintrc.json' } }] },
        ]);
        {
            using log = openOwnership(sandbox.path);
            writeGeneratedFiles(session, generated, log);
            expect(log.entryFor('app/package.json')?.configuration?.format).toBe('json');
        }
        expect(await readFile(join(sandbox.path, 'app/child/package.json'), 'utf8')).toBe(TAKEOVER_PACKAGE);
        expect(await readFile(join(sandbox.path, 'other/package.json'), 'utf8')).toBe(TAKEOVER_PACKAGE);
        expect(await readFile(join(sandbox.path, 'plain/package.json'), 'utf8')).toBe('{"private":true}\n');
        session = await openSession(sandbox.path);
        expect(
            getSuggestions(session).unowned.filter((row) => ['package.json', 'app/package.json'].includes(row.path)),
        ).toStrictEqual([]);
        expect(
            getSuggestions(session)
                .unowned.filter((row) => row.note.includes('stylelint'))
                .map(({ path, command }) => ({ path, command })),
        ).toStrictEqual(STYLELINT_SUGGESTIONS);
        const installed = await readFile(join(sandbox.path, 'app/package.json'), 'utf8');
        await writeFile(join(sandbox.path, 'app/package.json'), installed.replace('native-project', 'edited-project'));
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy([], { level, tables: '[agent_rules]\nenabled = false\n' }),
        );
        session = await openSession(sandbox.path);
        expect(emitAll(session).toolFiles).toStrictEqual([]);
        {
            using log = openOwnership(sandbox.path);
            writeGeneratedFiles(session, emitAll(session), log);
            expect(log.entryFor('package.json')).toBeUndefined();
            expect(log.entryFor('app/package.json')).toBeUndefined();
        }
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(TAKEOVER_PACKAGE);
        expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(
            TAKEOVER_PACKAGE.replace('native-project', 'edited-project'),
        );
    },
);

test.each(['recommended', 'all'] as const)(
    '%s captured Stylelint rules retain native options and filter inactive or unknown overrides',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['css'], {
                level,
                tables: `[agent_rules]
enabled = false
[tools.stylelint.rules]
color-hex-length = "long"
number-max-precision = 0
unknown-rule = true
[scope.child]
`,
            }),
            'source.css': 'a { color: #fff; width: 1.23456px; }',
            'child/source.css': 'a { color: #fff; width: 1.23456px; }',
        });
        const session = await openSession(sandbox.path);
        const generated = emitAll(session);
        for (const scope of ['', 'child']) {
            const file = generated.files.find(
                ({ path }) => path === `.gspot/config/${scope === '' ? '' : scope + '/'}stylelint.json`,
            )!;
            const config = JSON.parse(file.content) as Config;
            expect(config.rules!['color-hex-length']).toBe('long');
            expect(config.rules!['number-max-precision']).toBe(level === 'all' ? 0 : null);
            expect(config.rules!['unknown-rule']).toBeUndefined();
            const result = await stylelint.lint({
                code: 'a { color: #fff; width: 1.23456px; }',
                config,
                configBasedir: join(import.meta.dir, '../../node_modules'),
            });
            expect(
                result.results
                    .flatMap(({ warnings }) => warnings)
                    .filter(({ rule }) => rule === 'color-hex-length')
                    .map(({ severity }) => severity),
            ).toStrictEqual(['error']);
            expect(
                result.results
                    .flatMap(({ warnings }) => warnings)
                    .filter(({ rule }) => rule === 'number-max-precision'),
            ).toHaveLength(level === 'all' ? 1 : 0);
        }
    },
);
