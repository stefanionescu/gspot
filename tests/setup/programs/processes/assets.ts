import { readFileSync } from 'node:fs';
import { listAssets, buildAssetPath } from '#cli/system/assets.ts';

const text = readFileSync(buildAssetPath('configurations/language/bash/manifest.toml'), 'utf8');
process.stdout.write(`${JSON.stringify({ text, files: listAssets('configurations') })}\n`);
