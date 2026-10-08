import type { z } from 'zod';
import type { xccovSchema } from '#cli/parsers/schema/xctest.ts';

/** Native target coverage accepted by the xccov report schema. */
export type CoverageReport = z.infer<typeof xccovSchema>;
