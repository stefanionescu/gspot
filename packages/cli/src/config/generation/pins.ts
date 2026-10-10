import type { Policy } from '#cli/types/policy/settings.ts';
import type { ActionPin } from '#cli/types/generation/ci.ts';
import { SWIFT_GRAMMAR_FILE } from '#cli/config/platform/assets.ts';

/** Shared pins for generation, installation, downloads, and maintenance checks. */
export const CLI_PINS = {
    mise: { name: 'jdx/mise', version: '2026.10.7' },
    node: '24',
    actions: {
        checkout: {
            name: 'actions/checkout',
            sha: '3d3c42e5aac5ba805825da76410c181273ba90b1',
            version: 'v7.0.1',
        },
        mise: {
            name: 'jdx/mise-action',
            sha: '2d8d4cafcbd33be2ea37d2b6f5ad595363d1f1ca',
            version: 'v5.1.1',
        },
        cache: {
            name: 'actions/cache',
            sha: '55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
            version: 'v6.1.0',
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
