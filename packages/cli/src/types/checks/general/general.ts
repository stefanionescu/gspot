// The types of checks/general in this package.
import type { z } from 'zod';
import type { configurationSchema } from '#cli/checks/general/licenses.ts';
import type { cloneReportSchema } from '#cli/checks/general/duplication.ts';

export type LicenseException = z.infer<typeof configurationSchema>['exceptions'][number];

/** The validated native duplication report consumed by finding generation. */
export type CloneReport = z.infer<typeof cloneReportSchema>;
