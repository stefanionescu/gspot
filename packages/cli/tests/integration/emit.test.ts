import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { parse, stringify } from 'smol-toml';
import { createSandbox } from '@gspot/testing';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';

test.each([
    ['cloudflare', 'workers'],
    ['express', 'express'],
    ['fastapi', 'fastapi'],
    ['supabase', 'supabase'],
])('%s security output follows the selected security preset', async (preset, name) => {
    await using sandbox = await createSandbox({
        'gspot.toml': `version = 1\npresets = ["${preset}"]\n`,
    });
    const target = `.gspot/semgrep/${name}.yml`;
    const plainOutput = emitAll(await openSession(sandbox.path));
    expect(plainOutput.files.map((file) => file.path)).not.toContain(target);
    writeFileSync(join(sandbox.path, 'gspot.toml'), `version = 1\npresets = ["${preset}", "security"]\n`);
    const securityOutput = emitAll(await openSession(sandbox.path));
    const configuration = securityOutput.files.find((file) => file.path === target);
    expect(configuration?.content).toContain('rules:');
});

test('typos output preserves quoted keys and paths without creating settings', async () => {
    const words = ['quoted"word', 'dotted.word', String.raw`back\slash`, 'café', "apostrophe'word"];
    const paths = ['docs/"draft"/**', String.raw`generated/\draft/**`, 'café/**'];
    const reason = 'An upstream name.\n[files]\nextend-exclude = ["**"]';
    await using sandbox = await createSandbox({
        'gspot.toml': stringify({
            version: 1,
            presets: ['spelling'],
            tools: { typos: { words: words.map((word) => ({ word, reason })), exclude: [{ paths, reason }] } },
        }),
    });
    const output = emitAll(await openSession(sandbox.path));
    const target = output.files.find((file) => file.path === '.gspot/typos.toml');
    expect(target).toBeDefined();
    const parsed = parse(target!.content);
    expect(Object.keys(parsed).toSorted((left, right) => left.localeCompare(right))).toEqual(['default', 'files']);
    expect(parsed['default']).toMatchObject({ 'extend-words': Object.fromEntries(words.map((word) => [word, word])) });
    expect(parsed['files']).toMatchObject({ 'extend-exclude': expect.arrayContaining(paths) });
    expect(parsed['files']).not.toMatchObject({ 'extend-exclude': expect.arrayContaining(['**']) });
});

test('profile spelling values use the same TOML emission path', async () => {
    const word = 'café."upstream"';
    await using sandbox = await createSandbox({
        'house.profile.toml': stringify({
            version: 1,
            profile: 'house',
            selection: 'exact',
            presets: ['spelling'],
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
    const output = emitAll(await openSession(sandbox.path));
    const target = output.files.find((file) => file.path === '.gspot/typos.toml');
    expect(target).toBeDefined();
    expect(parse(target!.content)['default']).toMatchObject({ 'extend-words': { [word]: word } });
});
