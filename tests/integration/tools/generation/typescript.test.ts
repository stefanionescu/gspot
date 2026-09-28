import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { allRuleExamples } from '#cli/agents/examples.ts';
import { runProcess } from '#tests/support/cli/command.ts';

test.each(['recommended', 'all'] as const)(
    'TypeScript guide examples pass %s while an unused declaration fails',
    async (level) => {
        await using sandbox = await testdir();
        const examples = allRuleExamples().filter((example) => example.language === 'ts');
        expect(examples.length).toBeGreaterThan(0);
        await createFileTree(sandbox.path, {
            'tsconfig.json':
                '{"compilerOptions":{"strict":true,"noUncheckedIndexedAccess":true,"exactOptionalPropertyTypes":true,"noImplicitOverride":true,"forceConsistentCasingInFileNames":true,"target":"ESNext","module":"ESNext","moduleResolution":"Bundler","noEmit":true},"include":["*.ts"]}',
            'gspot.toml': `version = 1\nlevel = "${level}"\nkits = ["typescript"]\n`,
            ...Object.fromEntries(examples.map((example, index) => [`example-${String(index)}.ts`, example.body])),
        });
        const session = await openSession(sandbox.path);
        for (const file of emitAll(session.policyFiles.policy, session.repository, session.scopes, {
            version: session.version,
            packageClient: session.packageClient,
        }).files.filter((file) => file.kind === 'config'))
            await Bun.write(join(sandbox.path, file.path), file.content);
        symlinkSync(
            join(import.meta.dir, '../../../../.gspot/node_modules'),
            join(sandbox.path, '.gspot/node_modules'),
            'dir',
        );
        const first = examples[0]!;
        const target = join(sandbox.path, 'example-0.ts');
        await Bun.write(target, `const ABANDONED = 1;\n\n${first.body}`);
        const command = [
            process.execPath,
            join(sandbox.path, '.gspot/node_modules/eslint/bin/eslint.js'),
            '--config',
            '.gspot/config/eslint.config.mjs',
            '--format',
            'json',
            ...examples.map((_example, index) => `example-${String(index)}.ts`),
        ];
        const rejected = await runProcess(command, { cwd: sandbox.path });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        expect(JSON.parse(rejected.stdout)).toMatchObject([
            { messages: [{ ruleId: '@typescript-eslint/no-unused-vars' }] },
        ]);
        await Bun.write(target, first.body);
        const corrected = await runProcess(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toMatchObject(examples.map(() => ({ messages: [] })));
    },
);
