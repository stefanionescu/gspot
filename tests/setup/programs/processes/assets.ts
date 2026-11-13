import { readFileSync } from 'node:fs';

import { buildAssetPath, listAssets } from '#cli/system/package/assets.ts';

const text = readFileSync(buildAssetPath('src/configurations/language/bash/manifest.toml'), 'utf8');
process.stdout.write(`${JSON.stringify({ text, files: listAssets('src/configurations') })}\n`);
