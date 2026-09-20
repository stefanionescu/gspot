// Planted repository for the nestjs preset: a small module that lints and type-checks as written, a controller that injects a repository, a circular import, and a tsconfig with decorators off.
import { delimiter, join } from 'node:path';
import { createSandbox } from '@gspot/testing';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { existsSync, symlinkSync } from 'node:fs';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript',
    'nestjs',
    '--without',
    'naming',
    'spelling',
    'vitest',
    'security',
    'dependencies',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "@nestjs/common": "11.2.3",\n        "@nestjs/core": "11.2.3",\n        "reflect-metadata": "0.2.2",\n        "rxjs": "7.8.2"\n    }\n}\n';
const TSCONFIG = '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["src"]\n}\n';
const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        return `hello ${name}`;\n    }\n}\n";
const CONTROLLER =
    "// The routes that greet.\nimport { Controller, Get, Param } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";
const MODULE =
    "// The greeting feature.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";
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

const CASES: PlantedCase[] = [
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.controller.ts': REACHES_ROWS, 'src/greeting.repository.ts': REPOSITORY },
        expected: 'A controller reaches data through a service',
    },
    {
        check: 'typescript/eslint',
        files: { 'src/greeting.module.ts': CIRCULAR },
        expected: 'forwardRef papers over two modules',
    },
    {
        check: 'integrity/tsconfig-options',
        files: {
            'tsconfig.json': TSCONFIG.replace(
                '"include"',
                () => '"compilerOptions": { "emitDecoratorMetadata": false },\n    "include"',
            ),
        },
        expected: 'emitDecoratorMetadata is not on',
    },
];

describe('the nestjs preset', () => {
    test(
        'a module written the Nest way lints and type-checks, and the boundary rules fire on their planted defects',
        async () => {
            await using sandbox = await createSandbox({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': TSCONFIG,
                'src/greeting.service.ts': GREETER,
                'src/greeting.controller.ts': CONTROLLER,
                'src/greeting.module.ts': MODULE,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            // Nothing the framework asks for is held in a baseline: the module passes as written, file names included.
            const held = await run(sandbox.path, ['check', '--at', 'commit', '--no-cache'], environment);
            expect(held.code, held.stdout + held.stderr).toBe(0);
            const eslintFile = join(sandbox.path, '.gspot/baselines/eslint.json');
            const eslintHeld = existsSync(eslintFile) ? await Bun.file(eslintFile).text() : '';
            expect(eslintHeld, eslintHeld).toBe('');
            expect(
                existsSync(join(sandbox.path, '.gspot/baselines/structure.prefix-collisions.shared-prefix.json')),
            ).toBe(false);
            for (const id of ['typescript/eslint', 'typescript/tsc', 'integrity/tsconfig-options']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
