import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

/** One CLI repository and its finding-and-correction cases. */
export type FindingScenario = { name: string; repository: InProcessScenario; cases: FindingCase[] };
