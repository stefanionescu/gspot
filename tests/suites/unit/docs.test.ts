import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { DESCRIPTION } from '#docs/config/site.ts';

test('the docs and README copies retain the owner description and the packaged README links', async () => {
    const root = join(import.meta.dir, '../../..');
    const [readme, overview, packagedReadme] = await Promise.all([
        readFile(join(root, 'README.md'), 'utf8'),
        readFile(join(root, 'docs/src/content/docs/start/overview.md'), 'utf8'),
        readFile(join(root, 'packages/cli/README.md'), 'utf8'),
    ]);
    expect(readme.split('\n\n', 2)[1]).toBe(DESCRIPTION);
    expect(overview.replace(/^---\n[\s\S]*?\n---\n\n/u, '').split('\n\n', 1)[0]).toBe(DESCRIPTION);
    expect(packagedReadme).toBe(
        readme.replaceAll('](docs/', '](https://raw.githubusercontent.com/stefanionescu/gspot/main/docs/'),
    );
});
