import { createFixture } from 'fs-fixture';
import type { ToolPin } from '#types/manifest.ts';
import { describe, expect, test } from 'bun:test';
import { probeTool } from '#cli/platform/tool-probe.ts';

function library(name: string, version: string): ToolPin {
    return { name, kind: 'library', version, windows: true, installers: { npm: name } };
}

describe('the tool probe', () => {
    test('a library is found through its package.json, in the root or in a scope', async () => {
        await using fixture = await createFixture({
            'node_modules/globals/package.json': '{"name":"globals","version":"17.12.0"}',
            'api/node_modules/eslint-plugin-n/package.json': '{"name":"eslint-plugin-n","version":"18.3.0"}',
        });
        expect(probeTool(fixture.path, library('globals', '17.12.0')).state).toBe('ok');
        expect(probeTool(fixture.path, library('eslint-plugin-n', '18.3.0'), ['api']).state).toBe('ok');
    });

    test('a library that is absent is missing, and one off its pin is reported', async () => {
        await using fixture = await createFixture({
            'node_modules/typescript/package.json': '{"name":"typescript","version":"6.0.0"}',
        });
        const absent = probeTool(fixture.path, library('eslint-plugin-regexp', '3.3.0'));
        expect(absent.state).toBe('missing');
        expect(absent.want).toBe('3.3.0');
        const newer = probeTool(fixture.path, library('typescript', '5.9.3'));
        expect(newer.state).toBe('newer');
        expect(newer.found).toBe('6.0.0');
    });
});
