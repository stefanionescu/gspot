import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

/** Declared Swagger use selects its lint contracts without importing the SDK in this source. */
export const SWAGGER_DEPENDENCY = '11.2.3';

export const NESTJS_DEPENDENCIES = {
    '@nestjs/common': '11.2.3',
    '@nestjs/core': '11.2.3',
    'reflect-metadata': '0.2.2',
    rxjs: '7.8.2',
};

export const NESTJS_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true,\n        "experimentalDecorators": true,\n        "emitDecoratorMetadata": true\n    },\n    "include": [\n        "src"\n    ]\n}' +
    '\n';

export const GREETER =
    "// The greetings the service knows.\nimport { Injectable } from '@nestjs/common';\n\n/** Builds greetings. */\n@Injectable()\nexport class GreetingService {\n    /**\n     * Greets one person.\n     * @param name the person\n     * @returns the greeting\n     */\n    greet(name: string): string {\n        if (name.trim() === '') {\n            throw new Error('A greeting requires a name.');\n        }\n        return `hello ${name.trim()}`;\n    }\n}\n";

export const CONTROLLER =
    "// The routes that greet.\nimport { Get, Param, Controller } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':name')\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";

export const NESTJS_MODULE =
    "// The greeting feature.\nimport { Module } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\nimport { GreetingController } from './greeting.controller.js';\n\n/** Wires the greeting feature together. */\n@Module({ controllers: [GreetingController], providers: [GreetingService] })\nexport class GreetingModule {}\n";

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['typescript', 'nestjs'],
    dependencies: NESTJS_DEPENDENCIES,
    files: {
        'tsconfig.json': NESTJS_TSCONFIG,
        'src/greeting.service.ts': GREETER,
        'src/greeting.controller.ts': CONTROLLER,
        'src/greeting.module.ts': NESTJS_MODULE,
    },
    without: ['naming', 'spelling', 'security', 'dependencies'],
};

export const MISMATCHED =
    "// The routes that greet.\nimport { Get, Param, Controller } from '@nestjs/common';\nimport { GreetingService } from './greeting.service.js';\n\n/** Answers greeting requests. */\n@Controller('greetings')\nexport class GreetingController {\n    /**\n     * Takes the service that builds greetings.\n     * @param greetings the service\n     */\n    constructor(private readonly greetings: GreetingService) {}\n\n    /**\n     * Greets the person the route names.\n     * @param name the person\n     * @returns the greeting\n     */\n    @Get(':id')\n    greet(@Param('name') name: string): string {\n        return this.greetings.greet(name);\n    }\n}\n";

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: { 'src/greeting.controller.ts': MISMATCHED },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 20,
        },
    },
];
