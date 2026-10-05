export const ASSETS_CONFIGURATION = '[configuration]\nname = "bash"\n';

export const CHECKOUT = 'workspace % café';

export const ASSET_READER_SCRIPT = `import { readAsset, listAssets, wasmPath } from './packages/cli/src/platform/assets.ts';
import { GRAMMAR_PACKAGES, RUNTIME_WASM, SWIFT_GRAMMAR_FILE } from './packages/cli/src/config/platform/assets.ts';
for (const name of [...Object.keys(GRAMMAR_PACKAGES), ...Object.keys(RUNTIME_WASM), SWIFT_GRAMMAR_FILE]) {
    if (!WebAssembly.validate(await Bun.file(wasmPath(name)).arrayBuffer())) throw new Error(name);
}
try { wasmPath('undeclared.wasm'); throw new Error('Undeclared asset was accepted.'); }
catch (error) { if (!String(error).includes('No WebAssembly file named undeclared.wasm ships with gspot.')) throw error; }
console.log(JSON.stringify({ text: readAsset('configurations/language/bash/manifest.toml'), files: listAssets('configurations') }));
`;
