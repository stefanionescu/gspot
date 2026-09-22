import { rejects } from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { expect, test } from 'bun:test';
import { validateSiteLinks } from '../../docs/scripts/links';

test('built-site validation covers landing fragments, relative manual links, encoded paths, and assets', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'index.html': '<h1 id="finding">Finding</h1><a href="/guide/">Guide</a><img src="/assets/diagram.png">',
        'guide/index.html': `<a href="/#finding">Finding</a><a href="../${encodeURIComponent('café.html')}#example">Example</a>`,
        'café.html': '<h1 id="example">Example</h1>',
        'assets/diagram.png': 'fixture',
    });
    const directory = pathToFileURL(`${sandbox.path}/`);
    await validateSiteLinks(directory, 'https://gspot.dev');
    writeFileSync(join(sandbox.path, 'index.html'), '<a href="/guide/#missing">Missing section</a>');
    await rejects(validateSiteLinks(directory, 'https://gspot.dev'), { message: /fragment #missing does not exist/u });
    writeFileSync(join(sandbox.path, 'index.html'), '<h1 id="finding">Finding</h1><a href="/absent/">Missing page</a>');
    await rejects(validateSiteLinks(directory, 'https://gspot.dev'), { message: /destination does not exist/u });
    writeFileSync(join(sandbox.path, 'index.html'), '<h1 id="finding">Finding</h1><img src="/assets/missing.png">');
    await rejects(validateSiteLinks(directory, 'https://gspot.dev'), {
        message: /missing.png: destination does not exist/u,
    });
    writeFileSync(
        join(sandbox.path, 'index.html'),
        '<h1 id="finding">Finding</h1><a href="https://example.com">External</a>',
    );
    await validateSiteLinks(directory, 'https://gspot.dev');
    expect(await Bun.file(join(sandbox.path, 'guide/index.html')).text()).toContain('/#finding');
});
