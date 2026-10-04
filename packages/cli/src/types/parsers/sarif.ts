import type { z } from 'zod';
import type { sarifLogSchema } from '#cli/parsers/schema/sarif.ts';

export type SarifRun = z.infer<typeof sarifLogSchema>['runs'][number];
export type SarifArtifactLocation = NonNullable<SarifRun['artifacts']>[number]['location'];
export type SarifPhysicalLocation = NonNullable<SarifRun['results'][number]['locations']>[number]['physicalLocation'];
export type SarifPlace = { file: string; line: number; column?: number };
