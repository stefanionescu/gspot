import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { TAKEOVER_PACKAGE } from '#tests/config/samples/css.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { getSuggestions } from '#cli/commands/doctor/suggestions.ts';
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
            writeGeneratedFiles(session, log, undefined, generated);
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
            writeGeneratedFiles(session, log);
            expect(log.entryFor('package.json')).toBeUndefined();
            expect(log.entryFor('app/package.json')).toBeUndefined();
        }
        expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(TAKEOVER_PACKAGE);
        expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(
            TAKEOVER_PACKAGE.replace('native-project', 'edited-project'),
        );
    },
);
