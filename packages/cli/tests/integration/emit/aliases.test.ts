import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';
import { templateInputs } from '#cli/emit/templates.ts';

test.each(['package.json', 'tsconfig.json'])(
    'generation reports malformed %s instead of dropping aliases',
    async (path) => {
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
            [path]: '{}',
        });
        const session = await openSession(sandbox.path);
        writeFileSync(join(sandbox.path, path), '{ "compilerOptions": { "paths": {} },');
        expect(() => emitAll(session)).toThrow(`Cannot read configuration ${join(sandbox.path, path)}`);
    },
);

test.each(['package.json', 'tsconfig.json'])(
    'generation reports unreadable %s instead of dropping aliases',
    async (path) => {
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
            [path]: null,
        });
        const session = await openSession(sandbox.path);
        expect(() => emitAll(session)).toThrow(`Cannot read configuration ${join(sandbox.path, path)}`);
    },
);

test('alias discovery accepts absent files and valid TypeScript comments and trailing commas', async () => {
    await using sandbox = await createSandbox({
        'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
    });
    const session = await openSession(sandbox.path);
    const inputs = templateInputs(session, session.scopes[0]!);
    expect(inputs.importAliases('')).toEqual({});
    writeFileSync(
        join(sandbox.path, 'tsconfig.json'),
        `{
        // TypeScript permits comments and trailing commas.
        "compilerOptions": { "paths": { "@app/*": ["./src/*"], }, },
    }`,
    );
    expect(inputs.importAliases('')).toEqual({ '@app/': 'src/' });
});
