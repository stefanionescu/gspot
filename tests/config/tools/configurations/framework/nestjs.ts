import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

/** Declared Swagger use selects its lint contracts without importing the SDK in this source. */
export const SWAGGER_DEPENDENCY = '11.2.3';

export const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        if (name.trim() === '') {\n            throw new Error('A greeting requires a name.');\n        }\n        return `hello ${name.trim()}`;\n    }\n}\n";

export const CONTROLLER =
    "// The routes that greet.\nimport { GreetingService } from './greeting.service.js';\nimport { Get, Param, Controller } from '@nestjs/common';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";

export const NESTJS_MODULE =
    "// The greeting feature.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";

export const REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'nestjs'],
    tsconfig: {
        compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
        include: ['src'],
    },
    files: {
        'src/greeting.service.ts': GREETER,
        'src/greeting.controller.ts': CONTROLLER,
        'src/greeting.module.ts': NESTJS_MODULE,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: {},
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 20,
        },
    },
];
