import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import type * as DetectLibc from 'detect-libc';
import { cpSync, mkdirSync, symlinkSync } from 'node:fs';
import releaseTargets from '#npm-targets' with { type: 'json' };
import { environmentVariables } from '#cli/platform/environment.ts';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// The C library of a Linux host, which selects its release target; other platforms have none.
function hostLibc(): string | null {
    if (process.platform !== 'linux') return null;
    const { familySync: libcFamily } = requireCli('detect-libc') as typeof DetectLibc;
    return libcFamily();
}

const inherited = environmentVariables();

export const root = fileURLToPath(new URL('../../..', import.meta.url));
export const requireCli = createRequire(join(root, 'packages/cli/package.json'));
export const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === hostLibc(),
)!;
export const environment: Record<string, string | undefined> = {
    ...inherited,
    NODE_PATH: undefined,
    NODE_OPTIONS: undefined,
    PATH: (inherited['PATH'] ?? '')
        .split(delimiter)
        .filter((entry) => {
            const path = relative(root, resolve(entry));
            return path.startsWith(`..${sep}`) || path === '..' || isAbsolute(path);
        })
        .join(delimiter),
};

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
