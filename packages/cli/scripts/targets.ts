import { z } from 'zod';
import { readFileSync } from 'node:fs';

const targetSchema = z.object({
    os: z.enum(['darwin', 'linux', 'win32']),
    cpu: z.enum(['arm64', 'x64']),
    libc: z.enum(['glibc', 'musl']).nullable(),
    target: z.string().startsWith('bun-'),
    binary: z.string().regex(/^gspot-[a-z0-9.-]+$/u),
    package: z.string().startsWith('@gspot/cli-'),
});

// The npm launcher owns the target table and ships it, so the build reads that file rather than a copy.
const definitions: unknown = JSON.parse(readFileSync(new URL('../../npm/targets.json', import.meta.url), 'utf8'));

export const releaseTargets = z.array(targetSchema).parse(definitions);
