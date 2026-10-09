import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { RuffConfiguration } from '#tests/types/cli/generation/configuration-files.ts';

test.each(['recommended', 'all'] as const)('%s Ruff selects stable rules with preview disabled', async (level) => {
    const text = await emitFile(
        buildPolicy(['python', 'fastapi', 'pytest'], { level: level }),
        '.gspot/config/ruff.toml',
        {
            'sample.py': 'value = 1',
        },
    );
    const config = parseToml(text) as RuffConfiguration;
    const python = configurationManifests().get('python')!;
    expect(config.lint.select).toContain(python.ruff_rules[level][0]!);
    const types = await emitFile(buildPolicy(['python'], { level }), '.gspot/config/basedpyrightconfig.json', {
        'sample.py': 'value = 1',
    });
    expect(JSON.parse(types)).toHaveProperty(
        'typeCheckingMode',
        python.basedpyright_options[level]['typeCheckingMode'],
    );
});

test('switching levels restores generated defaults and agent instructions', async () => {
    await using sandbox = await testdir();
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const policy = buildPolicy(['javascript'], { agentRules: true, level: level });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, output, log);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Selected level: \`${level}\``);
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});
