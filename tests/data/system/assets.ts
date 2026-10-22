export const BASH_MANIFEST = '[configuration]\nname = "bash"\n';

export const PACKAGE_FOLDER = 'workspace % café';
export const ASSET_READER_SCRIPT = `import { readFileSync } from 'node:fs';
import { listAssets, buildAssetPath } from './packages/cli/src/system/assets.ts';
const text = readFileSync(buildAssetPath('configurations/language/bash/manifest.toml'), 'utf8');
console.log(JSON.stringify({ text, files: listAssets('configurations') }));
`;

export const PACKAGE_FOLDER_FILES = {
    'packages/cli/configurations/.index.json': '{}',
    'packages/cli/configurations/language/bash/.meta/state.json': '{}',
} as const;
