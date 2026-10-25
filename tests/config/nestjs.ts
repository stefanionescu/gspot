import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

export const NESTJS_CONTROLLER = `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

/**
Answers greeting requests.
*/
@Controller('greetings')
export class GreetingController {
    /**
    Takes the service that builds greetings.

    @param greetings dependency that formats the response
    */
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS injects the service through this constructor.
    constructor(private readonly greetings: GreetingService) {}

    /**
    Greets the person the route names.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    @Get(':name')
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS routes each request to this method.
    greet(@Param('name') name: string): string {
        return this.greetings.greet(name);
    }
}
`;

export const NESTJS_CONTROLLER_UNSUPPRESSED = NESTJS_CONTROLLER.replaceAll(
    /^ {4}\/\/ eslint-disable-next-line gspot\/no-trivial-functions -- reason: .*\n/gmu,
    '',
);

export const NESTJS_SANDBOX = {
    configurations: ['typescript', 'nestjs'],
    json: {
        'tsconfig.json': {
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, experimentalDecorators: true, emitDecoratorMetadata: true },
            include: ['src'],
        },
    },
    files: {
        'src/greeting.service.ts': `// The greetings the service knows.
import { Injectable } from '@nestjs/common';

/**
Builds greetings.
*/
@Injectable()
export class GreetingService {
    /**
    Greets one person.

    @param name route text to trim and include in the response
    @returns trimmed visitor text with a hello prefix
    */
    greet(name: string): string {
        if (name.trim() === '') {
            throw new Error('A greeting requires a name.');
        }
        return \`hello \${name.trim()}\`;
    }
}
`,
        'src/greeting.controller.ts': NESTJS_CONTROLLER_UNSUPPRESSED,
        'src/greeting.module.ts': `// The greeting feature.
import { Module } from '@nestjs/common';
import { GreetingService } from './greeting.service.js';
import { GreetingController } from './greeting.controller.js';

/**
Wires the greeting feature together.
*/
@Module({ controllers: [GreetingController], providers: [GreetingService] })
export class GreetingModule {}
`,
    },
} as const;
