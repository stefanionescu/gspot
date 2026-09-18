// .github/workflows/gspot.yml.
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile, WorkflowShape } from '#types/emit.ts';

const CHECKOUT = 'actions/checkout@34e114876b0b11c390a56381ad4ec7f4b0d0a6ae';
const MISE = 'jdx/mise-action@5ac50f778e26fac95da98d50503682459e86d566';
const SARIF = 'github/codeql-action/upload-sarif@df5a14dc28094dc936e103b37d749c6628682b60';
const RELEASES = 'https://github.com/stefanionescu/gspot/releases/download';

const RUNNERS: Record<string, string> = { ubuntu: 'ubuntu-latest', macos: 'macos-latest', windows: 'windows-latest' };

function setupSteps(shape: WorkflowShape): string[] {
    if (shape.isMise) return [`      - uses: ${MISE}`, '      - run: mise run gspot:setup'];
    const url = `${RELEASES}/v${shape.version}/gspot-$(uname -s | tr A-Z a-z)-$(uname -m)`;
    return [
        `      - run: curl -fsSL "${url}" -o /usr/local/bin/gspot && chmod +x /usr/local/bin/gspot`,
        '      - run: gspot doctor',
        '      - run: gspot apply',
    ];
}

function jobHead(name: string, runner: string, setup: string[]): string[] {
    return [
        `  ${name}:`,
        `    runs-on: ${runner}`,
        '    steps:',
        `      - uses: ${CHECKOUT}`,
        '        with:',
        '          fetch-depth: 0',
        ...setup,
    ];
}

function checkJob(platform: string, setup: string[]): string[] {
    return [
        ...jobHead(`check-${platform}`, RUNNERS[platform] ?? 'ubuntu-latest', setup),
        '      - run: gspot check --json > gspot.json',
        '      - run: gspot check --stage manual',
        "        if: github.event_name == 'push' && github.ref == 'refs/heads/main'",
        `      - uses: ${SARIF}`,
        '        if: always()',
        '        with:',
        '          sarif_file: .gspot/last.sarif',
    ];
}

function swiftJob(shape: WorkflowShape, setup: string[]): string[] {
    if (shape.swiftScope === undefined || shape.platforms.includes('macos')) return [];
    return [...jobHead('swift', 'macos-latest', setup), `      - run: gspot check --scope ${shape.swiftScope}`];
}

/**
 * The workflow: one job per platform in [ci] platforms, plus a macOS job when a Swift scope exists.
 * @param shape the version, the platforms, the Swift scope and the runner surface
 * @returns the generated file
 */
export function workflowFile(shape: WorkflowShape): GeneratedFile {
    const setup = setupSteps(shape);
    const content = [
        headerFor('gspot.yml', shape.version).trimEnd(),
        'name: gspot',
        'on: [push, pull_request]',
        'permissions:',
        '  contents: read',
        '  security-events: write',
        'jobs:',
        ...shape.platforms.flatMap((platform) => checkJob(platform, setup)),
        ...swiftJob(shape, setup),
        '',
    ].join('\n');
    return { path: '.github/workflows/gspot.yml', content, readOnly: true, kind: 'workflow' };
}
