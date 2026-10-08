export const ASSETS_CONFIGURATION = '[configuration]\nname = "bash"\n';

export const CHECKOUT = 'workspace % café';

export const ASSET_READER_SCRIPT = `import { readAsset, listAssets, wasmPath } from './packages/cli/src/platform/root/public.ts';
import { GRAMMAR_PACKAGES, RUNTIME_WASM, SWIFT_GRAMMAR_FILE } from './packages/cli/src/config/platform/assets.ts';
const grammars = Object.fromEntries(await Promise.all([...Object.keys(GRAMMAR_PACKAGES), ...Object.keys(RUNTIME_WASM), SWIFT_GRAMMAR_FILE].map(async (name) => [name, WebAssembly.validate(await Bun.file(wasmPath(name)).arrayBuffer())])));
let undeclared;
try { wasmPath('undeclared.wasm'); }
catch (error) { undeclared = error.message; }
console.log(JSON.stringify({ grammars, undeclared, text: readAsset('configurations/language/bash/manifest.toml'), files: listAssets('configurations') }));
`;
