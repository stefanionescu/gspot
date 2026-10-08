import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse as parseToml } from 'smol-toml';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { RUFF_PREVIEW_RULES } from '#tests/config/cli/generation/level-contract.ts';
import type { RuffConfiguration } from '#tests/types/generation/configuration-files.ts';

test('a scope resolves its own tool settings over the root defaults', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python', 'pytest'], {
            tables: '[scope."app"]\nconfigurations = []\n[scope."app".coverage]\nlines = 91\n[scope."app".tools.ruff]\ndocstring_convention = "numpy"\n',
            level: 'all',
        }),
        'app/main.py': 'value = 1\n',
    });
    const session = await openSession(sandbox.path);
    const nested = session.scopes.find((scope) => scope.scope.path === 'app')!;
    expect(nested.view.settings['coverage.lines']).toBe(91);
    expect(nested.view.settings['tools.ruff.docstring_convention']).toBe('numpy');
});

test.each(['recommended', 'all'] as const)('%s Ruff selects stable rules with preview disabled', async (level) => {
    const text = await emitFile(
        buildPolicy(['python', 'fastapi', 'pytest'], { level: level }),
        '.gspot/config/ruff.toml',
        {
            'sample.py': 'value = 1',
        },
    );
    const config = parseToml(text) as RuffConfiguration;
    expect(config.lint.select.filter((code) => RUFF_PREVIEW_RULES.has(code))).toStrictEqual([]);
    expect(config.lint.select.includes('N802')).toBe(level === 'all');
    expect(config.lint.select.includes('PT001')).toBe(level === 'all');
    expect(config.lint.select).toContain('PT009');
    expect(config.lint.select).toContain('FAST003');
    for (const code of ['C901', 'PLR2004', 'ERA001', 'T201', 'T203'])
        expect(config.lint.select.includes(code), code).toBe(level === 'all');
    expect(config.lint.select).not.toContain('PLR0915');
    const types = await emitFile(buildPolicy(['python'], { level }), '.gspot/config/basedpyrightconfig.json', {
        'sample.py': 'value = 1',
    });
    expect(JSON.parse(types)).toHaveProperty('reportImportCycles', level === 'all' ? 'error' : 'none');
    for (const rule of [
        'reportUnusedImport',
        'reportUnusedVariable',
        'reportRedeclaration',
        'reportUndefinedVariable',
        'reportIgnoreCommentWithoutRule',
        'reportPrivateUsage',
        'reportSelfClsParameterName',
    ])
        expect(JSON.parse(types)).toHaveProperty(rule, 'none');
});

test('switching levels restores generated defaults and agent instructions', async () => {
    await using sandbox = await testdir();
    await Bun.write(join(sandbox.path, 'source.js'), 'export const value = 1;\n');
    const outputs: string[] = [];
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const policy = buildPolicy(['javascript'], { level: level });
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy);
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        const config = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!;
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, log, undefined, output);
        const block = output.blocks.find((block) => block.path === 'AGENTS.md')!.block;
        expect(block).toContain(`Selected level: \`${level}\``);
        outputs.push(config.content);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
    expect(outputs[2]).toBe(outputs[0]);
});
