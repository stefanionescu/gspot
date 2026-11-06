import { realpathSync, statSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { preparePath } from '#cli/system/files/bounded.ts';

export function copyValePackages(root: string, copyRoot: string): void {
    const source = join(root, GSPOT_PATHS.valePackages);
    if (statSync(source, { throwIfNoEntry: false })?.isDirectory() !== true) return;
    const target = preparePath({ root: realpathSync(resolve(copyRoot)) }, GSPOT_PATHS.valePackages);
    symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}
