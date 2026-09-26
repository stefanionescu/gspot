// The literal values integration/cli/platform reads: names, patterns, limits, and tables.

export const ASSETS_CONFIGURATION = '[configuration]\nname = "bash"\n';
export const CHECKOUT = 'workspace % café';
export const SOURCES = [
    'packages/cli/package.json',
    'packages/cli/src/platform/assets.ts',
    'packages/cli/src/platform/paths.ts',
    'packages/cli/src/platform/environment.ts',
    'packages/cli/src/repository/hooks.ts',
    'packages/cli/src/constants/platform.ts',
    'packages/cli/src/constants/repository/repository.ts',
];
export const ASSET_READER_SCRIPT = `import { readAsset, listAssets, grammarPath, GRAMMAR_NAMES } from './packages/cli/src/platform/assets.ts';
for (const name of GRAMMAR_NAMES) {
    if (!WebAssembly.validate(await Bun.file(grammarPath(name)).arrayBuffer())) throw new Error(name);
}
try { grammarPath('undeclared.wasm'); throw new Error('Undeclared asset was accepted.'); }
catch (error) { if (!String(error).includes('No grammar is called')) throw error; }
console.log(JSON.stringify({ text: readAsset('packages/cli/configurations/language/bash/manifest.toml'), files: listAssets('packages/cli/configurations') }));
`;
