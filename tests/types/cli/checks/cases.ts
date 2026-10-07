import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

/** One CLI repository and its finding-and-correction cases. */
export type FindingScenario = { name: string; repository: RepositoryScenario; cases: FindingCase[] };
