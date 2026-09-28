import { z } from 'zod';
// eslint-disable-next-line gspot/no-cross-folder-imports, gspot/no-cross-project-imports -- reason: The npm launcher owns the shared release target contract.
import definitions from '../../npm/targets.json' with { type: 'json' };

const targetSchema = z.object({
    os: z.enum(['darwin', 'linux', 'win32']),
    cpu: z.enum(['arm64', 'x64']),
    libc: z.enum(['glibc', 'musl']).nullable(),
    target: z.string().startsWith('bun-'),
    binary: z.string().regex(/^gspot-[a-z0-9.-]+$/u),
    package: z.string().startsWith('@gspot/cli-'),
});

export const releaseTargets = z.array(targetSchema).parse(definitions);
