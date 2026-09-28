// NestJS fixtures cover valid injection and modules. Defects cover circular imports, unmatched route parameters, and disabled decorators.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect, describe } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';

import {
    GREETER,
    CONTROLLER,
    REPOSITORY,
    NESTJS_MODULE,
    NESTJS_TSCONFIG,
    NESTJS_DEPENDENCIES,
} from '#tests/config/acceptance/source/kits/kits.ts';

const REACHES_ROWS = CONTROLLER.replace(
    'constructor(private readonly greetings: GreetingService) {}',
    () =>
        'constructor(\n        private readonly greetings: GreetingService,\n        private readonly rows: GreetingRepository,\n    ) {}',
).replace(
    "import { GreetingService } from './greeting.service.js';",
    () =>
        "import { GreetingService } from './greeting.service.js';\nimport { GreetingRepository } from './greeting.repository.js';",
);
const CIRCULAR = NESTJS_MODULE.replace(
    "import { Module } from '@nestjs/common';",
    () => "import { forwardRef, Module } from '@nestjs/common';",
).replace('@Module({ controllers', () => '@Module({ imports: [forwardRef(() => GreetingModule)], controllers');
const MISMATCHED = CONTROLLER.replace("@Get(':name')", () => "@Get(':id')");

const CASES: FindingCase[] = [
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.controller.ts': REACHES_ROWS, 'src/greeting.repository.ts': REPOSITORY },
        expected: { file: 'src/greeting.controller.ts', rule: 'no-restricted-syntax', line: 15 },
    },
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.module.ts': CIRCULAR },
        expected: { file: 'src/greeting.module.ts', rule: 'no-restricted-syntax', line: 8 },
    },
    {
        check: 'integrity/tsconfig-options',
        files: { 'tsconfig.json': NESTJS_TSCONFIG.replace('"strict": true', '"strict": false') },
        expected: { file: 'tsconfig.json', rule: 'strict' },
    },
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.controller.ts': MISMATCHED },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 20,
        },
    },
    {
        check: 'integrity/tsconfig-options',
        files: { 'tsconfig.json': NESTJS_TSCONFIG.replace(',\n        "emitDecoratorMetadata": true', '') },
        expected: { file: 'tsconfig.json', rule: 'emitDecoratorMetadata' },
    },
];

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests build this fixture; inlining it puts a test over the line limit.
const installNest = (root: string): Promise<Record<string, string>> =>
    installSandbox(root, {
        kits: ['typescript', 'nestjs'],
        dependencies: NESTJS_DEPENDENCIES,
        files: {
            'tsconfig.json': NESTJS_TSCONFIG,
            'src/greeting.service.ts': GREETER,
            'src/greeting.controller.ts': CONTROLLER,
            'src/greeting.module.ts': NESTJS_MODULE,
        },
        without: ['security', 'dependencies'],
    });

describe('the nestjs configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts the corrected Nest module',
        async (planted) => {
            await using sandbox = await testdir();
            const environment = await installNest(sandbox.path);
            for (const id of ['typescript/eslint', 'typescript/tsc', 'integrity/tsconfig-options']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            const correctedCheck = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(correctedCheck.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 8,
    );

    test(
        'tools.nestjs.swagger turns the Swagger rules of the NestJS plugin on and off',
        async () => {
            await using sandbox = await testdir();
            const environment = await installNest(sandbox.path);
            const documented = await run(sandbox.path, ['set', 'tools.nestjs.swagger', 'true'], environment);
            expect(documented.code, documented.stdout + documented.stderr).toBe(0);
            const swagger = await run(
                sandbox.path,
                ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                environment,
            );
            expect(swagger.code, swagger.stdout + swagger.stderr).toBe(1);
            expect(reportSchema.parse(JSON.parse(swagger.stdout)).checks[0]!.findings).toContainEqual(
                containing({
                    rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
                    file: 'src/greeting.controller.ts',
                }),
            );
            const plain = await run(sandbox.path, ['set', 'tools.nestjs.swagger', 'false'], environment);
            expect(plain.code, plain.stdout + plain.stderr).toBe(0);
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 6,
    );
});
