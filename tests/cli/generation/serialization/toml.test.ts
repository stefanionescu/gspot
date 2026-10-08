import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse, stringify } from 'smol-toml';
import { writeFile } from 'node:fs/promises';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { GSPOT_MISE_TOOL } from '#cli/config/configurations.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { emitPolicy, parseExpiryDate } from '#cli/policy/file.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { rejection, containingAll } from '#tests/harness/expectations.ts';

test('typos output preserves quoted keys and paths without creating settings', async () => {
    const words = ['quoted"word', 'dotted.word', String.raw`back\slash`, 'café', "apostrophe'word"];
    const paths = ['docs/"draft"/**', String.raw`generated/\draft/**`, 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['spelling'],
            words: Object.fromEntries(words.map((word) => [word, reason])),
            ignore: [{ check: 'spelling/typos', paths, reason }],
        }),
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
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
            'extend-identifiers': {},
            'extend-words': Object.fromEntries(words.map((word) => [word, word])),
        },
    });
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': containingAll(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': containingAll(['**']) });
});

test('a quoted word from a template reaches typos.toml through init', async () => {
    const word = 'café."upstream"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'house.template.toml': stringify({
            template: 'house',
            selection: 'exact',
            configurations: ['spelling'],
            words: { [word]: 'An upstream name with # and "quotes".' },
        }),
    });
    const plan = await initCommand(
        buildInitOptions(sandbox.path, {
            from: 'house.template.toml',
            isDryRun: true,
            hooks: false,
            ci: 'none',
            runner: 'none',
            agentRules: false,
        }),
    );
    expect(plan.exitCode).toBe(0);
    const policy = plan.json['policy'];
    if (typeof policy !== 'string') throw new Error('The initialization plan has no policy text.');
    await writeFile(join(sandbox.path, 'gspot.toml'), policy);
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const target = output.files.find((file) => file.path === '.gspot/config/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});

test('TOML tool configurations round-trip dynamic strings and option keys', async () => {
    const text = String.raw`café "quoted" \value # comment`;
    const path = 'docs/"draft"/**';
    const reason = 'Reviewed upstream.\n[extend]\nuseDefault = false';
    const option = 'custom."option"';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': emitPolicy('', {
            configurations: ['secrets', 'dependencies', 'files', 'docs', 'python'],
            format: { indent_style: 'tab' },
            tools: {
                taplo: { verbatim: { [option]: text, column_width: 88 } },
            },
            links: { allowed_urls: [text] },
            reasons: { 'tools.taplo.verbatim': reason, 'links.allowed_urls': reason },
            ignore: [
                { check: 'python/ruff', rule: 'F401', paths: [path], reason },
                { check: 'dependencies/osv', rule: text, reason, until: parseExpiryDate('2099-09-20') },
                { check: 'dependencies/osv', rule: 'GHSA-path-specific', paths: [path], reason },
            ],
        }),
        'sample.py': 'value = 1',
        'sample.md': '# Sample',
        'package.json': '{"private":true}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const parsed = new Map(
        output.files.filter((file) => file.path.endsWith('.toml')).map((file) => [file.path, parse(file.content)]),
    );
    expect(parsed.get('.gspot/config/osv-scanner.toml')).toMatchObject({
        IgnoredVulns: [{ id: text, reason, ignoreUntil: new Date('2099-09-20T00:00:00.000Z') }],
    });
    expect(parsed.get('.gspot/config/taplo.toml')).toMatchObject({
        formatting: { [option]: text, column_width: 88, indent_string: '\t' },
    });
    expect(parsed.get('.gspot/config/lychee.toml')).toMatchObject({ exclude: [text] });
    expect(parsed.get('.gspot/config/ruff.toml')).toMatchObject({ lint: { 'per-file-ignores': { [path]: ['F401'] } } });
});

test('an OSV expiry cannot inject another TOML table', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['dependencies'],
            ignore: [
                {
                    check: 'dependencies/osv',
                    rule: 'GHSA-example',
                    reason: 'Reviewed upstream.',
                    until: '2026-09-20\n[verbatim]\ninjected = true',
                },
            ],
        }),
    });
    expect(await rejection(openSession(sandbox.path))).toContain('ignore.0.until');
});

test('Mise pins the CLI through the npm backend', async () => {
    const text = await emitFile(buildPolicy([], { tables: 'runner = "mise"\n' }), MISE_CONFIG_PATH);
    expect(parse(text)['tools']).toMatchObject({ [GSPOT_MISE_TOOL]: packageManifest.version });
});
