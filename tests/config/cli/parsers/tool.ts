import type { SpawnResult } from '#cli/types/platform/runtime.ts';

export const VERSION_RESPONSE: SpawnResult = {
    code: 0,
    stdout: 'tool 4.4.2\n',
    stderr: '',
    missing: false,
    duration: 0,
};

/** Native mise diagnostics when its shim has no selected version. */
export const MISSING_TOOL_VERSION =
    'mise ERROR No version is set for shim: teller\nmise ERROR Run with --verbose for more information.\n';
