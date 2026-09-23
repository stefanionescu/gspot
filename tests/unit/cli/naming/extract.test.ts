import { describe, expect, test } from 'bun:test';
import { identifiersOf } from '#cli/naming/extract.ts';

const TS = `
export function parseHttpUrl(rawInput: string, { retries = 3, ...rest }: Options, [first, second]: string[]): void {}
const enhancedHandler = (event) => {};
let { data: payload } = source;
class HttpClient extends Base {
    #secret = 1;
    static readonly DEFAULT_PORT = 80;
    constructor(private readonly baseUrl: string) {}
    async send(body: Body): Promise<void> {}
}
interface Options { retries?: number; 'Content-Type': string }
type Verdict = 'ok';
enum Mode { Fast, Slow = 2 }
const table = { keyOne: 1 };
`;

describe('identifiersOf', () => {
    test('collects TypeScript declarations by category and skips object literal keys', async () => {
        const found = await identifiersOf('src/a.ts', TS, 'typescript');
        const byCategory = (category: string): string[] =>
            found.filter((entry) => entry.category === category).map((entry) => entry.name);
        expect(byCategory('functions')).toEqual(['parseHttpUrl']);
        expect(byCategory('parameters')).toEqual([
            'rawInput',
            'retries',
            'rest',
            'first',
            'second',
            'event',
            'baseUrl',
            'body',
        ]);
        expect(byCategory('variables')).toEqual(['enhancedHandler', 'payload', 'table']);
        expect(byCategory('classes')).toEqual(['HttpClient']);
        expect(byCategory('properties')).toEqual(['secret', 'DEFAULT_PORT', 'baseUrl', 'retries']);
        expect(byCategory('methods')).toEqual(['send']);
        expect(byCategory('types')).toEqual(['Options', 'Verdict', 'Mode']);
        expect(byCategory('enum_cases')).toEqual(['Fast', 'Slow']);
        expect(found.map((entry) => entry.name)).not.toContain('keyOne');
        expect(found.find((entry) => entry.name === 'send')?.line).toBe(9);
    });

    test('collects shell functions and variables', async () => {
        const found = await identifiersOf(
            'scripts/run.sh',
            'readonly ROOT=1\nlocal count\nbuild_all() {\n  TARGET=x\n}\n',
            'bash',
        );
        expect(found.map((entry) => `${entry.category}:${entry.name}`)).toEqual([
            'variables:ROOT',
            'variables:count',
            'functions:build_all',
            'variables:TARGET',
        ]);
    });

    test('a language without an extractor yields nothing', async () => {
        expect(await identifiersOf('a.rb', 'x = 1', 'ruby')).toEqual([]);
    });
});
