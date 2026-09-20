import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import type { MergedView } from '#types/config.ts';
import type { CheckSpec } from '#types/manifest.ts';
import type { Repository } from '#types/repository.ts';
import type { EngineInput, Session } from '#types/run.ts';
import { buildReproducible, siteBuild } from '#cli/web/site/build.ts';

function input(root: string, paths: string[]): EngineInput {
    const files = paths.map((path) => ({ path, nature: 'source' as const, tags: [], executable: false, size: 1 }));
    const view: Partial<MergedView> = { tool: () => ({ build: 'bun build.js' }) };
    const repository: Partial<Repository> = { files, scopes: [] };
    const session: Partial<Session> = { root, repository: repository as Repository };
    const spec: Partial<CheckSpec> = { id: 'static-site/build-reproducible' };
    return { root, scope: '', files, view: view as MergedView, session: session as Session, spec: spec as CheckSpec };
}

const BUILD = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;

describe('site build reproducibility', () => {
    test('the second build preserves the output shared with other checks', async () => {
        await using fixture = await createFixture({ 'build.js': BUILD });
        const request = input(fixture.path, ['build.js']);
        const first = await siteBuild(request);
        const before = readFileSync(join(first.output, 'index.html'), 'utf8');
        expect(first.isBuilt).toBe(true);
        expect(await buildReproducible(request)).toEqual([]);
        expect(readFileSync(join(first.output, 'index.html'), 'utf8')).toBe(before);
    });

    test('a failed second build reports an error instead of passing', async () => {
        await using fixture = await createFixture({
            'local-input.txt': 'Only available in the working tree.',
            'build.js': `import { readFileSync } from 'node:fs';
readFileSync('local-input.txt');
${BUILD}`,
        });
        const request = input(fixture.path, ['build.js']);
        const first = await siteBuild(request);
        expect(first.isBuilt).toBe(true);
        let failure: unknown;
        try {
            await buildReproducible(request);
        } catch (error_) {
            failure = error_;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(String(failure)).toContain('The second site build failed');
        expect(readFileSync(join(fixture.path, 'dist/index.html'), 'utf8')).toBe('first');
    });
});
