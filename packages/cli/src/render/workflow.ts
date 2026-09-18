// .github/workflows/gspot.yml.
import { headerFor } from '#cli/render/templates.ts';
import type { GeneratedFile } from '#types/render.ts';

const CHECKOUT = 'actions/checkout@34e114876b0b11c390a56381ad4ec7f4b0d0a6ae';
const MISE = 'jdx/mise-action@5ac50f778e26fac95da98d50503682459e86d566';
const SARIF = 'github/codeql-action/upload-sarif@df5a14dc28094dc936e103b37d749c6628682b60';

const RUNNERS: Record<string, string> = { ubuntu: 'ubuntu-latest', macos: 'macos-latest', windows: 'windows-latest' };

/** The workflow: one job per platform in [ci] platforms, plus a macOS job when a Swift scope exists. */
export function workflowFile(
    version: string,
    platforms: string[],
    hasSwift: boolean,
    swiftScope: string,
    withMise: boolean,
): GeneratedFile {
    const setup = withMise
        ? [`      - uses: ${MISE}`, '      - run: mise run gspot:setup']
        : [
              '      - run: curl -fsSL "https://github.com/stefanionescu/gspot/releases/download/v' +
                  version +
                  '/gspot-$(uname -s | tr A-Z a-z)-$(uname -m)" -o /usr/local/bin/gspot && chmod +x /usr/local/bin/gspot',
              '      - run: gspot doctor',
              '      - run: gspot sync',
          ];
    const jobs: string[] = [];
    for (const platform of platforms) {
        const runner = RUNNERS[platform] ?? 'ubuntu-latest';
        jobs.push(
            `  check-${platform}:`,
            `    runs-on: ${runner}`,
            '    steps:',
            `      - uses: ${CHECKOUT}`,
            '        with:',
            '          fetch-depth: 0',
            ...setup,
            '      - run: gspot check --json > gspot.json',
            '      - run: gspot check --stage manual',
            "        if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
            `      - uses: ${SARIF}`,
            '        if: always()',
            '        with:',
            '          sarif_file: .gspot/last.sarif',
        );
    }
    if (hasSwift && !platforms.includes('macos')) {
        jobs.push(
            '  swift:',
            '    runs-on: macos-latest',
            '    steps:',
            `      - uses: ${CHECKOUT}`,
            '        with:',
            '          fetch-depth: 0',
            ...setup,
            `      - run: gspot check --scope ${swiftScope}`,
        );
    }
    const content = [
        headerFor('gspot.yml', version).trimEnd(),
        'name: gspot',
        'on: [push, pull_request]',
        'permissions:',
        '  contents: read',
        '  security-events: write',
        'jobs:',
        ...jobs,
        '',
    ].join('\n');
    return { path: '.github/workflows/gspot.yml', content, readOnly: true, kind: 'workflow' };
}
