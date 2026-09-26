import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import { delimiter, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import releaseTargets from '../../../packages/npm/targets.json' with { type: 'json' };

export const root = fileURLToPath(new URL('../../..', import.meta.url));
export const requireCli = createRequire(join(root, 'packages/cli/package.json'));
const { familySync } = requireCli('detect-libc') as { familySync: () => string | null };
const libc = process.platform === 'linux' ? familySync() : null;
export const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
)!;
export const BINARY = host.binary;
export const RELEASE_TIMEOUT_MS = 180_000;

// Consumer processes cannot discover executables from the source checkout.
export const environment: Record<string, string | undefined> = {
    ...environmentVariables(),
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
};
environment['PATH'] = (environment['PATH'] ?? '')
    .split(delimiter)
    .filter((entry) => {
        const path = relative(root, resolve(entry));
        return path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || path === '..' || isAbsolute(path);
    })
    .join(delimiter);

export function preparePackages(work: string): string {
    const checkout = join(work, 'publish');
    for (const path of [
        'dist',
        'packages/npm',
        'packages/cli/package.json',
        'packages/cli/scripts/publish.ts',
        'packages/cli/scripts/targets.ts',
        'tsconfig.json',
    ]) {
        const target = join(checkout, path);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(join(root, path), target, { recursive: true });
    }
    symlinkSync(join(root, 'node_modules'), join(checkout, 'node_modules'), 'dir');
    symlinkSync(join(root, 'packages/cli/node_modules'), join(checkout, 'packages/cli/node_modules'), 'dir');
    return checkout;
}
