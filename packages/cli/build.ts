import { join } from 'node:path';
import { createHash } from 'node:crypto';
import cliPackage from './package.json' with { type: 'json' };
import { cpSync, rmSync, chmodSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const packageFolder = import.meta.dir;
const rootFolder = join(packageFolder, '../..');
const repositoryPath = new URL(cliPackage.repository.url.replace(/^git\+/u, '')).pathname.replace(/\.git$/u, '');
const assetURL = `https://raw.githubusercontent.com${repositoryPath}/v${cliPackage.version}/docs/public/`;
const downloadTimeout = 60_000;
const executableMode = 0o755;

const grammars = [
    {
        file: 'grammars/bash.wasm',
        checksum: '8292919c88a0f7d3fb31d0cd0253ca5a9531bc1ede82b0537f2c63dd8abe6a7a',
        url: 'https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.1/tree-sitter-bash.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-bash.txt',
        checksum: '49bf33cf78ef5897e4e161ce1517df7de1ae5042a65b6bcfd44401e0fc606559',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-bash/a06c2e4415e9bc0346c6b86d401879ffb44058f7/LICENSE',
    },
    {
        file: 'grammars/css.wasm',
        checksum: '8a23977fe271357cce6f254ef88c9bebf3854602d8046605aef6a45c02135c59',
        url: 'https://github.com/tree-sitter/tree-sitter-css/releases/download/v0.25.0/tree-sitter-css.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-css.txt',
        checksum: 'c5cfb43042b6b72045f4ba997834d0a7786d2793d91680868b5815b39f14fc78',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-css/dda5cfc5722c429eaba1c910ca32c2c0c5bb1a3f/LICENSE',
    },
    {
        file: 'grammars/html.wasm',
        checksum: 'c48fcd82c7ea8bf943180088ba7f28c48b2bb5287874179168bf9d31e394cf85',
        url: 'https://github.com/tree-sitter/tree-sitter-html/releases/download/v0.23.2/tree-sitter-html.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-html.txt',
        checksum: '2e0110e07abef7c2548b26ec9d6969775617ca539a0dc8dbeeb14d6452c711d1',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-html/5a5ca8551a179998360b4a4ca2c0f366a35acc03/LICENSE',
    },
    {
        file: 'grammars/javascript.wasm',
        checksum: '5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240',
        url: 'https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.25.0/tree-sitter-javascript.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-javascript.txt',
        checksum: '2e0110e07abef7c2548b26ec9d6969775617ca539a0dc8dbeeb14d6452c711d1',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-javascript/44c892e0be055ac465d5eeddae6d3e194424e7de/LICENSE',
    },
    {
        file: 'grammars/python.wasm',
        checksum: '16108b50df4ee9a30168794252ab55e7c93bfc5765d7fa0aa3e335752c515f47',
        url: 'https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.25.0/tree-sitter-python.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-python.txt',
        checksum: 'd724405ce238a22c0d35769c5a36b386ad5958192efe8bbb304fb2896254575f',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-python/293fdc02038ee2bf0e2e206711b69c90ac0d413f/LICENSE',
    },
    {
        file: 'grammars/typescript.wasm',
        checksum: '778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-typescript.wasm',
    },
    {
        file: 'grammars/tsx.wasm',
        checksum: '79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-tsx.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-typescript.txt',
        checksum: '49bf33cf78ef5897e4e161ce1517df7de1ae5042a65b6bcfd44401e0fc606559',
        url: 'https://raw.githubusercontent.com/tree-sitter/tree-sitter-typescript/f975a621f4e7f532fe322e13c4f79495e0a7b2e7/LICENSE',
    },
    {
        file: 'grammars/swift.wasm',
        checksum: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
        url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    },
    {
        file: 'grammars/licenses/tree-sitter-swift.txt',
        checksum: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
        url: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
    },
];

async function downloadGrammar({ file, checksum, url }: (typeof grammars)[number]): Promise<void> {
    const target = join(packageFolder, file);
    if (existsSync(target) && createHash('sha256').update(readFileSync(target)).digest('hex') === checksum) return;
    const response = await fetch(url, { signal: AbortSignal.timeout(downloadTimeout) });
    if (!response.ok) throw new Error(`${url} answered HTTP ${String(response.status)}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== checksum)
        throw new Error(`${url} does not match the SHA-256 checksum of ${file}.`);
    writeFileSync(target, bytes);
}

rmSync(join(packageFolder, 'dist'), { recursive: true, force: true });
await Bun.build({
    entrypoints: [join(packageFolder, 'src/bin.ts')],
    outdir: join(packageFolder, 'dist'),
    naming: 'gspot.js',
    banner: '#!/usr/bin/env node',
    target: 'node',
    format: 'esm',
    packages: 'external',
    minify: { whitespace: true, syntax: true },
});
chmodSync(join(packageFolder, 'dist/gspot.js'), executableMode);
await Bun.build({
    entrypoints: [join(packageFolder, 'src/checks/framework/site/purgecss-process.ts')],
    outdir: join(packageFolder, 'dist'),
    target: 'node',
    format: 'esm',
    packages: 'external',
    minify: { whitespace: true, syntax: true },
});
mkdirSync(join(packageFolder, 'grammars/licenses'), { recursive: true });
for (const grammar of grammars) await downloadGrammar(grammar);
writeFileSync(
    join(packageFolder, 'README.md'),
    readFileSync(join(rootFolder, 'README.md'), 'utf8').replaceAll('](docs/public/', `](${assetURL}`),
);
cpSync(join(rootFolder, 'LICENSE.md'), join(packageFolder, 'LICENSE.md'));
