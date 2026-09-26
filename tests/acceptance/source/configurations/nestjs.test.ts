import { join } from 'node:path';
import { testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import { installSandbox } from '#tests/support/cli/sandbox.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
// Planted repository for the nestjs configuration: a small module that lints and type-checks as written, a controller that injects a repository, a circular import, a route parameter that names no segment, and a tsconfig with decorators off.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';

const DEPENDENCIES = {
    '@nestjs/common': '11.2.3',
    '@nestjs/core': '11.2.3',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
};
const TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true,\n        "experimentalDecorators": true,\n        "emitDecoratorMetadata": true\n    },\n    "include": ["src"]\n}\n';
const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        if (name.trim() === '') {\n            throw new Error('A greeting requires a name.');\n        }\n        return `hello ${name.trim()}`;\n    }\n}\n";
const CONTROLLER =
    "// The routes that greet.\n// eslint-disable-next-line gspot/no-trivial-files -- reason: Nest requires the controller class that binds these routes.\nimport { Controller, Get, Param } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Nest injects this constructor dependency.\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    // eslint-disable-next-line gspot/no-trivial-functions -- reason: Nest invokes this decorated route method.\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";
const MODULE =
    "// The greeting feature.\n// eslint-disable-next-line gspot/no-trivial-files -- reason: Nest requires this module class to register its providers and controllers.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";
const REACHES_ROWS = CONTROLLER.replace(
    'constructor(private readonly greetings: GreetingService) {}',
    () =>
        'constructor(\n        private readonly greetings: GreetingService,\n        private readonly rows: GreetingRepository,\n    ) {}',
).replace(
    "import { GreetingService } from './greeting.service.js';",
    () =>
        "import { GreetingService } from './greeting.service.js';\nimport { GreetingRepository } from './greeting.repository.js';",
);
const REPOSITORY =
    "// Where greetings are kept.\nimport { Injectable } from '@nestjs/common';\n\n/** Keeps greetings. */\n@Injectable()\nexport class GreetingRepository {\n    /**\n     * Counts the greetings kept.\n     * @returns the count\n     */\n    count(): number {\n        return 0;\n    }\n}\n";
const CIRCULAR = MODULE.replace(
    "import { Module } from '@nestjs/common';",
    () => "import { forwardRef, Module } from '@nestjs/common';",
).replace('@Module({ controllers', () => '@Module({ imports: [forwardRef(() => GreetingModule)], controllers');
const MISMATCHED = CONTROLLER.replace("@Get(':name')", () => "@Get(':id')");

const CASES: FindingCase[] = [
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.controller.ts': REACHES_ROWS, 'src/greeting.repository.ts': REPOSITORY },
        expected: { file: 'src/greeting.controller.ts', rule: 'no-restricted-syntax', line: 17 },
    },
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.module.ts': CIRCULAR },
        expected: { file: 'src/greeting.module.ts', rule: 'no-restricted-syntax', line: 8 },
    },
    {
        check: 'integrity/tsconfig-options',
        files: { 'tsconfig.json': TSCONFIG.replace('"strict": true', '"strict": false') },
        expected: { file: 'tsconfig.json', rule: 'strict' },
    },
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.controller.ts': MISMATCHED },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 23,
        },
    },
    {
        check: 'integrity/tsconfig-options',
        files: { 'tsconfig.json': TSCONFIG.replace(',\n        "emitDecoratorMetadata": true', '') },
        expected: { file: 'tsconfig.json', rule: 'emitDecoratorMetadata' },
    },
];

const installNest = (root: string): Promise<Record<string, string>> =>
    installSandbox(root, {
        configurations: ['typescript', 'nestjs'],
        dependencies: DEPENDENCIES,
        files: {
            'tsconfig.json': TSCONFIG,
            'src/greeting.service.ts': GREETER,
            'src/greeting.controller.ts': CONTROLLER,
            'src/greeting.module.ts': MODULE,
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
            await expectCorrected(sandbox.path, planted.check, environment);
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
