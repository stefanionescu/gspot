import { z } from 'zod';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';

/** A percentage shared by native reports and repository policy. */
export const percentageSchema = z.number().min(0).max(FULL_PERCENTAGE);
