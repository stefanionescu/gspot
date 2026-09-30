// The xctest analyses, by the name a manifest check gives them.
import type { Engine } from '#cli/types/checks.ts';
import { testCoverage } from '#cli/checks/xctest/coverage.ts';
import { referenceOwners } from '#cli/checks/xctest/references.ts';
import { noSleep, disabledTests, recordingMode } from '#cli/checks/xctest/line-checks.ts';

export const XCTEST_ANALYSES: Record<string, Engine> = {
    'xctest-disabled': disabledTests,
    'xctest-sleep': noSleep,
    'xctest-recording': recordingMode,
    'xctest-references': referenceOwners,
    'xctest-coverage': testCoverage,
};
