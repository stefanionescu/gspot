import { QUIET_INIT } from '#tests/config/harness/init.ts';

export const SECURITY_INIT = ['init', '--yes', '--configurations', 'typescript', 'security', ...QUIET_INIT];

export const SECURITY_CLEAN = 'export function double(value: number): number {\n    return value * 2;\n}\n';

export const EVALUATED =
    'export function run(code: string): unknown {\n    // eslint-disable-next-line no-eval -- test\n    return eval(code);\n}\n';

export const OWN_RULE =
    'rules:\n    - id: test-no-double\n      pattern: double(...)\n      message: The test rule of the repository fires here.\n      languages: [typescript]\n      severity: ERROR\n';

/** Configuration owned by Bearer, which Semgrep must preserve at initialization. */
export const BEARER_FILES = {
    'bearer.yml': 'severity: [critical, high]\n',
    'bearer.ignore': 'src/vendor.ts\n',
};
