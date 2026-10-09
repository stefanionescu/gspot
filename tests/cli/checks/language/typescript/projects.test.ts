import ts from 'typescript';
import type { z } from 'zod';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { emitAll } from '#cli/generation/public.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import { createReadCache } from '#cli/platform/root/public.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import type { typeScriptConfigSchema } from '#cli/parsers/schema/public.ts';
import { compilerFiles, compilerCopyInputs } from '#cli/checks/language/contracts.ts';

import {
    VALID,
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    IMPORTED_AMBIENT_FILES,
} from '#tests/config/samples/typescript.ts';

test.each(['recommended', 'all'] as const)(
    '%s audits a covering ancestor once and keeps child-only audits',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[scope."app"]\nconfigurations = ["typescript"]',
            }),
            'tsconfig.json': VALID.replace('"strict":true', '"strict":false'),
            'root.ts': ROOT_PORT_SOURCE,
            'app/source.ts': CHILD_PORT_SOURCE,
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] });
        expect(BUILT_IN_CHECKS['typescript/tsconfig'].input(input)).toMatchObject([
            { file: 'tsconfig.json', rule: 'strict' },
        ]);
        expect(() =>
            BUILT_IN_CHECKS['typescript/tsconfig'].input(buildCheckInput(session, 'typescript/tsconfig')),
        ).toThrow(
            expect.objectContaining({
                name: 'GspotError',
                code: 'skip',
                errors: ['An ancestor compiler check covers this project.'],
                message: 'An ancestor compiler check covers this project.',
            }),
        );
        const generated = emitAll(session).files.find(({ path }) => path === '.gspot/config/app/tsconfig.json');
        expect(JSON.parse(generated!.content)).toMatchObject({ extends: '../../../tsconfig.json' });
        const reopened = await openSession(sandbox.path);
        expect(
            BUILT_IN_CHECKS['typescript/tsconfig'].input(buildCheckInput(reopened, 'typescript/tsconfig')),
        ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
        expect(() =>
            BUILT_IN_CHECKS['typescript/tsconfig'].input(
                buildCheckInput(reopened, 'typescript/tsconfig', { scope: 'app' }),
            ),
        ).toThrow(
            expect.objectContaining({
                name: 'GspotError',
                code: 'skip',
                errors: ['An ancestor compiler check covers this project.'],
                message: 'An ancestor compiler check covers this project.',
            }),
        );
    },
);

test.each(['recommended', 'all'] as const)(
    '%s leaves an excluded child as a standalone compiler project',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[scope."app"]\nconfigurations = ["typescript"]',
            }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["root.ts"],"exclude":["app/**"]}',
            'root.ts': ROOT_PORT_SOURCE,
            'app/source.ts': CHILD_PORT_SOURCE,
        });
        const session = await openSession(sandbox.path);
        expect(
            BUILT_IN_CHECKS['typescript/tsconfig'].input(
                buildCheckInput(session, 'typescript/tsconfig', { scope: 'app' }),
            ),
        ).toStrictEqual([]);
        const generated = emitAll(session).files.find(({ path }) => path === '.gspot/config/app/tsconfig.json');
        const config = JSON.parse(generated!.content) as z.infer<typeof typeScriptConfigSchema>;
        expect(config['extends']).toBeUndefined();
        expect(config['files']).toStrictEqual(['../../../app/source.ts']);
    },
);

test('a copied compiler retains an imported ambient declaration absent from configuration roots', async () => {
    await using sandbox = await testdir({
        ...IMPORTED_AMBIENT_FILES,
        'gspot.toml': buildPolicy(['javascript'], { tables: '[scope."apps/web"]\n' }),
    });
    const session = await openSession(sandbox.path);
    const target = join(session.root, 'apps/web/jsconfig.json');
    const parsed = getTsconfig(session.root, target, session.reads)!;
    const planned = planRun(session, { stage: 'all', skips: [], only: ['javascript/tsc'] }).find(
        (check) => check.scope.scope.path === 'apps/web',
    )!;
    expect(parsed.fileNames.map((path) => toPosix(relative(session.root, path)))).toStrictEqual([
        'apps/web/src/main.js',
    ]);
    const projects = new Map([[target, parsed]]);
    const source = compilerCopyInputs(session, planned, projects, compilerFiles(session, planned, projects));
    expect(source.paths).toContain('types/api.d.ts');
    expect(source.paths).not.toContain('sibling/bad.js');
    expect(ts.createProgram(parsed.fileNames, parsed.options).getSemanticDiagnostics()).toStrictEqual([]);
    using copied = await copyIntoScratch(source);
    const privateConfig = getTsconfig(
        copied.path,
        join(copied.path, 'apps/web/jsconfig.json'),
        createReadCache(copied.path),
    )!;
    expect(ts.createProgram(privateConfig.fileNames, privateConfig.options).getSemanticDiagnostics()).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'types/api.d.ts'), 'export declare const amount: string;\n');
    const changed = await openSession(sandbox.path);
    const config = getTsconfig(changed.root, target, changed.reads)!;
    expect(
        ts
            .createProgram(config.fileNames, config.options)
            .getSemanticDiagnostics()
            .map(({ code }) => code),
    ).toStrictEqual([2339]);
    await using foreign = await testdir({
        'node_modules/foreign/index.d.ts': 'export declare const amount: number;\n',
    });
    await writeFile(
        join(sandbox.path, 'base.json'),
        IMPORTED_AMBIENT_FILES['base.json'].replace(
            '"types/api.d.ts"',
            JSON.stringify(join(foreign.path, 'node_modules/foreign/index.d.ts')),
        ),
    );
    const outside = await openSession(sandbox.path);
    const outsideConfig = getTsconfig(outside.root, target, outside.reads)!;
    expect(() => compilerFiles(outside, planned, new Map([[target, outsideConfig]]))).toThrow('Unsafe lifecycle path');
    await writeFile(join(sandbox.path, 'base.json'), IMPORTED_AMBIENT_FILES['base.json'].replace('api.d.ts', 'api.js'));
    await writeFile(join(sandbox.path, 'types/api.js'), 'export const amount = 1;\n');
    const crossed = await openSession(sandbox.path);
    const crossedConfig = getTsconfig(crossed.root, target, crossed.reads)!;
    expect(() => compilerFiles(crossed, planned, new Map([[target, crossedConfig]]))).toThrow(
        'imports source outside its scope: types/api.js',
    );
});
