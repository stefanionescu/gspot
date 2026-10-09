import type { Policy } from '#cli/types/policy/settings.ts';
import type { ActionPin } from '#cli/types/generation/ci.ts';
import { SWIFT_GRAMMAR_FILE } from '#cli/config/platform/assets.ts';

/** Release pins shared by generation, installation, downloads, and maintenance validation. */
export const CLI_PINS = {
    mise: { name: 'jdx/mise', version: '2026.8.8' },
    node: '24',
    actions: {
        checkout: {
            name: 'actions/checkout',
            sha: '34e114876b0b11c390a56381ad16ebd13914f8d5',
            version: 'v4.3.1',
        },
        mise: {
            name: 'jdx/mise-action',
            sha: '5ac50f778e26fac95da98d50503682459e86d566',
            version: 'v3.2.0',
        },
        cache: {
            name: 'actions/cache',
            sha: '5a3ec84eff668545956fd18022155c47e93e2684',
            version: 'v4.2.3',
        },
        node: {
            name: 'actions/setup-node',
            sha: '820762786026740c76f36085b0efc47a31fe5020',
            version: 'v7.0.0',
        },
    } satisfies Record<string, ActionPin>,
    runners: { linux: 'ubuntu-24.04', macos: 'macos-15', windows: 'windows-2025' } satisfies Record<
        NonNullable<Policy['ci']>['platforms'][number],
        string
    >,
    swiftGrammar: {
        name: SWIFT_GRAMMAR_FILE,
        version: '0.7.3',
        url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
        checksum: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
        license: {
            url: 'https://raw.githubusercontent.com/alex-pinkus/tree-sitter-swift/b8b22bffbb3441780e6471665bacfb263741c86a/LICENSE',
            checksum: '3533cec129bb4bba015c0d61d86dd7c3b7e82110e4d2ff7837a01eff5bad5ccc',
        },
    },
};
