import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

/** One configuration's installed repository and native finding cases. */
export type ConfigurationScenario = { name: string; repository: RepositoryScenario; cases: FindingCase[] } & Pick<
    FindingCase,
    'platforms'
>;

/** Generated Bash sample and fix with its exact source expectation. */
export type BashBoundary = { source: string; corrected: string; expected: FindingCase['expected'] & { file: string } };

/** Runtime repository preparation and generated cases for the declared sandbox. */
export type ConfigurationCallbacks = Partial<RepositoryScenario> & Pick<Partial<ConfigurationScenario>, 'cases'>;
