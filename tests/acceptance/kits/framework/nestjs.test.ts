// A clean NestJS module passes every check, and the NestJS plugin reports a route parameter its decorator does not name.
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';

const NESTJS_DEPENDENCIES = {
    '@nestjs/common': '11.2.3',
    '@nestjs/core': '11.2.3',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
};

const NESTJS_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true,\n        "experimentalDecorators": true,\n        "emitDecoratorMetadata": true\n    },\n    "include": ["src"]\n}\n';

const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        if (name.trim() === '') {\n            throw new Error('A greeting requires a name.');\n        }\n        return `hello ${name.trim()}`;\n    }\n}\n";

const CONTROLLER =
    "// The routes that greet.\nimport { Get, Param, Controller } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";

const NESTJS_MODULE =
    "// The greeting feature.\n// eslint-disable-next-line gspot/no-trivial-files -- reason: Nest requires this module class to register its providers and controllers.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";

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
            files: { 'src/greeting.controller.ts': MISMATCHED },
            expected: {
                file: 'src/greeting.controller.ts',
                rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
                line: 20,
            },
        },
    ],
    (planted) => {
        test(
            'the lint, type, and compiler option checks accept the clean Nest module',
            async () => {
                const { root, environment } = planted();
                for (const id of ['typescript/eslint', 'typescript/tsc', 'integrity/tsconfig-options']) {
                    const clean = await spawnGspot(root, ['check', '--only', id], environment);
                    expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                }
            },
            PLANTED_TIMEOUT_MS * 4,
        );
    },
);
