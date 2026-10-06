import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';

test.each(['{"extends":"./.gspot/tsconfig.json", invalid}', 'null', '[]'])(
    'malformed TypeScript configuration fails generation: %s',
    async (content) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'tsconfig.json': content,
            'gspot.toml': buildPolicy(['typescript']),
            'source.ts': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        expect(() => emitAll(session)).toThrow('Cannot read TypeScript configuration');
    },
);
