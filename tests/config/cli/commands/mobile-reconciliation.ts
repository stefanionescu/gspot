/** Native project policy before Expo or React DOM dependencies appear. */
import type { SpawnResult } from '#cli/types/platform/runtime.ts';

export const MOBILE_RECONCILIATION_POLICY = `configurations = ["react-native"]
[agent_rules]
enabled = false
[tools.eslint.rules]
"react-native/no-raw-text" = ["error", { skip = ["ProjectText"] }]
`;

/** The declared package manager version supplied by the process boundary. */
export const NPM_VERSION = '11.19.0';

/** A successful command with no diagnostic output. */
export const NPM_SUCCESS: SpawnResult = { code: 0, missing: false, duration: 1, stdout: '', stderr: '' };
