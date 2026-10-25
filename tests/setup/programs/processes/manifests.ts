import { spyOn } from 'bun:test';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as assets from '#cli/system/assets.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { rmSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

const input = JSON.parse(process.argv[2] ?? '{}') as { files: Record<string, string>; assets: string[] };
const paths = Object.keys(input.files);
const folder = mkdtempSync(join(tmpdir(), 'gspot-manifests-'));
for (const [path, text] of Object.entries(input.files)) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
}

const buildAssetPath = assets.buildAssetPath;
using listing = spyOn(assets, 'listAssets').mockImplementation((prefix) =>
    prefix === 'configurations/' ? paths : input.assets.filter((path) => path.startsWith(prefix)),
);
using locating = spyOn(assets, 'buildAssetPath').mockImplementation((path) =>
    path in input.files ? join(folder, path) : buildAssetPath(path),
);
try {
    process.stdout.write(JSON.stringify([...readConfigurations()]));
} catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    rmSync(folder, { recursive: true, force: true });
}
