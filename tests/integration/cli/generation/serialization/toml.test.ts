import { initCommand } from '#cli/commands/init/command.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitAll } from '#cli/generation/render.ts';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'smol-toml';
import { createFileTree, testdir } from 'testdirs';

test('typos output preserves quoted keys and paths without creating settings', async () => {
    const words = ['quoted"word', 'dotted.word', String.raw`back\slash`, 'café', "apostrophe'word"];
    const paths = ['docs/"draft"/**', String.raw`generated/\draft/**`, 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['spelling'],
            tools: { typos: { words: words.map((word) => ({ word, reason })), exclude: [{ paths, reason }] } },
        }),
    });
    const renderSession1 = await openSession(sandbox.path);
    const output = emitAll(renderSession1.policyFiles.policy, renderSession1.repository, renderSession1.scopes, {
        version: renderSession1.version,
        packageManager: renderSession1.packageManager,
    });
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content);
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        'default',
        'files',
        'type',
    ]);
    expect(parsed['type']).toStrictEqual({
        'gspot-policy': {
            'extend-glob': ['gspot.toml'],
            'extend-words': Object.fromEntries(words.map((word) => [word, word])),
        },
    });
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': expect.arrayContaining(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': expect.arrayContaining(['**']) });
});

test('profile spelling values use the same TOML emission path', async () => {
    const word = 'café."upstream"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'house.profile.toml': stringify({
            version: 1,
            profile: 'house',
            selection: 'exact',
            configurations: ['spelling'],
            tools: { typos: { words: [{ word, reason: 'An upstream name with # and "quotes".' }] } },
        }),
    });
    const proposal = await initCommand({
        cwd: sandbox.path,
        from: 'house.profile.toml',
        yes: true,
        isDryRun: true,
        json: true,
        install: false,
        allowDirty: true,
        hooks: 'none',
        ci: 'none',
        runner: 'none',
        rules: 'no',
    });
    expect(proposal.exitCode).toBe(0);
    const policy = proposal.json['policy'];
    if (typeof policy !== 'string') throw new Error('The initialization proposal has no policy text.');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy);
    const renderSession2 = await openSession(sandbox.path);
    const output = emitAll(renderSession2.policyFiles.policy, renderSession2.repository, renderSession2.scopes, {
        version: renderSession2.version,
        packageManager: renderSession2.packageManager,
    });
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});

test('TOML tool configurations round-trip dynamic strings and option keys', async () => {
    const text = 'café "quoted" \\value # comment';
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['secrets', 'dependencies', 'configs', 'docs', 'python', 'postgres'],
            format: { indent_style: 'tab' },
            tools: {
                gitleaks: { allow: [{ description: text, paths: [path], regexes: [text], reason }] },
                osv: { ignore: [{ id: text, reason, review_by: '2026-09-20' }] },
                taplo: { rules: { [option]: text, column_width: 88 } },
                lychee: { exclude: [{ patterns: [text], reason }] },
                squawk: { frozen_through: 'all' },
            },
            ignore: [{ check: 'python/ruff', rule: 'F401', paths: [path], reason }],
        }),
        'migrations/20260101_initial.sql': 'select 1;\n',
    });
    const renderSession3 = await openSession(sandbox.path);
    const output = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
        version: renderSession3.version,
        packageManager: renderSession3.packageManager,
    });
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parse(file.content)]),
    );
    expect(parsed.get('.gspot/config/gitleaks.toml')).toStrictEqual({
        extend: { useDefault: true },
        allowlists: [{ description: text, paths: [path], regexes: [text] }],
    });
    expect(parsed.get('.gspot/config/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2026-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/config/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/config/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/config/ruff.toml')).toMatchObject({ lint: { 'per-file-ignores': { [path]: ['F401'] } } });
    expect(parsed.get('.gspot/config/squawk.toml')).toMatchObject({
        excluded_paths: ['migrations/20260101_initial.sql'],
    });
});

test('an OSV expiry cannot inject another TOML table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: ['dependencies'],
            tools: {
                osv: {
                    ignore: [
                        {
                            id: 'GHSA-example',
                            reason: 'Reviewed upstream.',
                            review_by: '2026-09-20\n[extra]\ninjected = true',
                        },
                    ],
                },
            },
        }),
    });
    const session = await openSession(sandbox.path);
    expect(() =>
        emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageManager: session.packageManager,
        }),
    ).toThrow();
});
