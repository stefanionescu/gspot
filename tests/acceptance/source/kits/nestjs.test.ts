// NestJS fixtures cover valid injection and modules. Defects cover circular imports, unmatched route parameters, and disabled decorators.
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { containing } from '#tests/support/expectations.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

import {
    GREETER,
    CONTROLLER,
    REPOSITORY,
    NESTJS_MODULE,
    NESTJS_TSCONFIG,
    NESTJS_DEPENDENCIES,
} from '#tests/inputs/acceptance/source/kits/kits.ts';

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
    () => "import { Module, forwardRef } from '@nestjs/common';",
).replace('@Module({ controllers', () => '@Module({ imports: [forwardRef(() => GreetingModule)], controllers');
const MISMATCHED = CONTROLLER.replace("@Get(':name')", () => "@Get(':id')");

plantedCases(
    'the nestjs configuration',
    {
        kits: ['typescript', 'nestjs'],
        dependencies: NESTJS_DEPENDENCIES,
        files: {
            'tsconfig.json': NESTJS_TSCONFIG,
            'src/greeting.service.ts': GREETER,
            'src/greeting.controller.ts': CONTROLLER,
            'src/greeting.module.ts': NESTJS_MODULE,
        },
        without: ['naming', 'spelling', 'security', 'dependencies'],
    },
    [
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
    ],
    (planted) => {
        test(
            'the lint, type, and compiler option checks accept the clean Nest module',
            async () => {
                const { root, environment } = planted();
                for (const id of ['typescript/eslint', 'typescript/tsc', 'integrity/tsconfig-options']) {
                    const clean = await run(root, ['check', '--only', id, '--no-cache'], environment);
                    expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                }
            },
            PLANTED_TIMEOUT_MS * 4,
        );

        test(
            'tools.nestjs.swagger turns the Swagger rules of the NestJS plugin on and off',
            async () => {
                const { root, environment } = planted();
                const documented = await run(root, ['set', 'tools.nestjs.swagger', 'true'], environment);
                expect(documented.code, documented.stdout + documented.stderr).toBe(0);
                const swagger = await run(
                    root,
                    ['check', '--only', 'typescript/eslint', '--no-cache', '--json'],
                    environment,
                );
                expect(swagger.code, swagger.stdout + swagger.stderr).toBe(1);
                expect((JSON.parse(swagger.stdout) as RunReport).checks[0]?.findings).toContainEqual(
                    containing({
                        rule: '@darraghor/nestjs-typed/controllers-should-supply-api-tags',
                        file: 'src/greeting.controller.ts',
                    }),
                );
                const plain = await run(root, ['set', 'tools.nestjs.swagger', 'false'], environment);
                expect(plain.code, plain.stdout + plain.stderr).toBe(0);
                const clean = await run(root, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
                expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            },
            PLANTED_TIMEOUT_MS * 6,
        );
    },
);
