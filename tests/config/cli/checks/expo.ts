import { PASSING_REPORT } from '#tests/config/samples/expo.ts';
import type { DoctorResult } from '#tests/types/cli/checks/expo.ts';
import { REPORT, EXPECTED_ISSUES } from '#tests/config/cli/parsers/expo.ts';

/** The supported Doctor reports and an unstructured process failure. */
export const DOCTOR_RESULTS: DoctorResult[] = [
    {
        name: 'failed SDK checks',
        expected: EXPECTED_ISSUES,
        result: { code: 1, missing: false, duration: 1, stdout: REPORT, stderr: '' },
    },
    {
        name: 'successful checks',
        expected: [],
        result: {
            code: 0,
            missing: false,
            duration: 1,
            stdout: PASSING_REPORT,
            stderr: '',
        },
    },
    {
        name: 'unstructured failure',
        result: { code: 1, missing: false, duration: 1, stdout: '', stderr: 'Unable to read Expo configuration' },
        expected: 'Expo Doctor exited 1: Unable to read Expo configuration',
    },
];

/** Installed Doctor's version response at the subprocess boundary. */
export const DOCTOR_VERSION = { code: 0, missing: false, duration: 1, stdout: '1.20.4\n', stderr: '' };
