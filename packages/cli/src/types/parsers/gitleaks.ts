import type { z } from 'zod';
import type { gitleaksBaselineSchema } from '#cli/parsers/schema/gitleaks.ts';

/** A validated baseline record retains only fields the check consumes. */
export type GitleaksEntry = z.infer<typeof gitleaksBaselineSchema>[number];
