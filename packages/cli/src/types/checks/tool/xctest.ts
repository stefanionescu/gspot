import type { z } from 'zod';
import type { xccovSchema } from '#cli/parsers/schema/xctest.ts';

/** A native coverage report accepted by the xccov schema. */
export type CoverageReport = z.infer<typeof xccovSchema>;

/** One coverage floor of the policy. */
export type CoverageFloor = { target: string; percent: number };
