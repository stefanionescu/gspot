import type { z } from 'zod';
import type { sarifLogSchema } from '#cli/parsers/output/structured/contracts.ts';

export type SarifRun = z.infer<typeof sarifLogSchema>['runs'][number];
export type SarifArtifactLocation = NonNullable<NonNullable<SarifRun['artifacts']>[number]['location']>;
export type SarifPhysicalLocation = NonNullable<SarifRun['results'][number]['locations']>[number]['physicalLocation'];
