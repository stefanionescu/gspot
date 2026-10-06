import { test } from 'bun:test';
import { join } from 'node:path';
import { throws } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { MALFORMED_COMPILER_CONFIGURATIONS } from '#tests/config/cli/generation/typescript.ts';

test.each(MALFORMED_COMPILER_CONFIGURATIONS)(
    'malformed TypeScript configuration fails generation: %s',
    async (content, detail) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'tsconfig.json': content,
            'gspot.toml': buildPolicy(['typescript']),
            'source.ts': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        throws(() => emitAll(session), {
            message: `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}: ${detail}`,
        });
    },
);
