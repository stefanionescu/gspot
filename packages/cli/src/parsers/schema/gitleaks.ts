import { z } from 'zod';

/** Baseline fields consumed by the reviewed-secret check; other native report fields are ignored. */
export const gitleaksBaselineSchema = z.array(
    z.object({ Fingerprint: z.string().min(1), File: z.string().min(1), Commit: z.string().optional() }),
);
