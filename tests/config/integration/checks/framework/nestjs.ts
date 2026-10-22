export const NESTJS_CONTROLLER = `// The routes that greet.
import { GreetingService } from './greeting.service.js';
import { Get, Param, Controller } from '@nestjs/common';

/** Answers greeting requests. */
@Controller('greetings')
export class GreetingController {
    /**
     * Takes the service that builds greetings.
     *
     * @param greetings dependency that formats the response
     */
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS injects the service through this constructor.
    constructor(private readonly greetings: GreetingService) {}

    /**
     * Greets the person the route names.
     *
     * @param name route text to trim and include in the response
     * @returns trimmed visitor text with a hello prefix
     */
    @Get(':name')
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: NestJS routes each request to this method.
    greet(@Param('name') name: string): string {
        return this.greetings.greet(name);
    }
}
`;

export const NESTJS_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/greeting.controller.ts': NESTJS_CONTROLLER.replace("@Param('name')", "@Param('other')"),
        },
        corrected: { files: { 'src/greeting.controller.ts': NESTJS_CONTROLLER } },
        expected: {
            file: 'src/greeting.controller.ts',
            rule: '@darraghor/nestjs-typed/param-decorator-name-matches-route-param',
            line: 24,
        },
    },
] as const;
