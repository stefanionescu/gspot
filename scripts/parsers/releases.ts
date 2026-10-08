import { z } from 'zod';

// npm declares ESLint compatibility here. The other registries need only a released document.
export const releaseDocumentSchema = z.object({
    peerDependencies: z.record(z.string(), z.string()).optional(),
});
