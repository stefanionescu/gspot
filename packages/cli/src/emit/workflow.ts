// .github/workflows/gspot.yml.
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile, WorkflowShape } from '#types/emit.ts';

const CHECKOUT = 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5';
const MISE = 'jdx/mise-action@5ac50f778e26fac95da98d50503682459e86d566';
const SARIF = 'github/codeql-action/upload-sarif@df5a14dc28094dc936e103b37d749c6628682b60';
const RELEASES = 'https://github.com/stefanionescu/gspot/releases/download';

const RUNNERS: Record<string, string> = { ubuntu: 'ubuntu-latest', macos: 'macos-latest', windows: 'windows-latest' };

const ASSET_CASES = [
    '            Linux-x86_64) asset=gspot-linux-x64 ;;',
    '            Linux-aarch64) asset=gspot-linux-arm64 ;;',
    '            Darwin-arm64) asset=gspot-darwin-arm64 ;;',
    '            Darwin-x86_64) asset=gspot-darwin-x64 ;;',
];

// uname prints x86_64 and aarch64; the release assets end in x64 and arm64, so the step maps one to the other and verifies the checksum.
function unixInstall(version: string): string[] {
    const base = `${RELEASES}/v${version}`;
    return [
        '      - name: Install gspot',
        '        run: |',
        '          case "$(uname -s)-$(uname -m)" in',
        ...ASSET_CASES,
        '            *) echo "gspot has no build for this runner"; exit 2 ;;',
        '          esac',
        `          curl -fsSL "${base}/$asset" -o "$RUNNER_TEMP/gspot"`,
        `          curl -fsSL "${base}/checksums.txt" -o "$RUNNER_TEMP/checksums.txt"`,
        String.raw`          expected="$(grep "  $asset\$" "$RUNNER_TEMP/checksums.txt" | cut -d' ' -f1)"`,
        `          actual="$(shasum -a 256 "$RUNNER_TEMP/gspot" | cut -d' ' -f1)"`,
        '          test -n "$expected" && test "$expected" = "$actual"',
        '          mkdir -p "$HOME/.local/bin"',
        '          install -m 0755 "$RUNNER_TEMP/gspot" "$HOME/.local/bin/gspot"',
        '          echo "$HOME/.local/bin" >> "$GITHUB_PATH"',
    ];
}

function windowsInstall(version: string): string[] {
    const base = `${RELEASES}/v${version}`;
    return [
        '      - name: Install gspot',
        '        shell: pwsh',
        '        run: |',
        "          $asset = 'gspot-windows-x64.exe'",
        "          $bin = Join-Path $env:RUNNER_TEMP 'gspot-bin'",
        '          New-Item -ItemType Directory -Force -Path $bin | Out-Null',
        `          Invoke-WebRequest "${base}/$asset" -OutFile (Join-Path $bin 'gspot.exe')`,
        `          Invoke-WebRequest "${base}/checksums.txt" -OutFile (Join-Path $bin 'checksums.txt')`,
        "          $expected = ((Get-Content (Join-Path $bin 'checksums.txt')) -match \"  $asset$\" | Select-Object -First 1).Split(' ')[0]",
        "          $actual = (Get-FileHash (Join-Path $bin 'gspot.exe') -Algorithm SHA256).Hash.ToLower()",
        "          if (-not $expected -or $expected -ne $actual) { throw 'The gspot checksum does not match.' }",
        '          Add-Content $env:GITHUB_PATH $bin',
    ];
}

function setupSteps(shape: WorkflowShape, platform: string): string[] {
    if (shape.isMise) return [`      - uses: ${MISE} # v3.2.0`, '      - run: mise run gspot:setup'];
    const install = platform === 'windows' ? windowsInstall(shape.version) : unixInstall(shape.version);
    return [...install, '      - run: gspot doctor', '      - run: gspot apply'];
}

function jobHead(name: string, runner: string, setup: string[]): string[] {
    return [
        `  ${name}:`,
        `    runs-on: ${runner}`,
        '    steps:',
        `      - uses: ${CHECKOUT} # v4.3.1`,
        '        with:',
        '          fetch-depth: 0',
        ...setup,
    ];
}

function checkJob(shape: WorkflowShape, platform: string): string[] {
    const command = shape.isMise ? 'mise run gspot:check --' : 'gspot check';
    return [
        ...jobHead(`check-${platform}`, RUNNERS[platform] ?? 'ubuntu-latest', setupSteps(shape, platform)),
        `      - run: ${command}`,
        `      - run: ${command} --at manual`,
        "        if: github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
        `      - uses: ${SARIF} # v3.25.0`,
        "        if: always() && hashFiles('.gspot/report.sarif') != ''",
        '        with:',
        '          sarif_file: .gspot/report.sarif',
    ];
}

function swiftJob(shape: WorkflowShape): string[] {
    if (shape.swiftScope === undefined || shape.platforms.includes('macos')) return [];
    const command = shape.isMise ? 'mise run gspot:check --' : 'gspot check';
    return [
        ...jobHead('swift', 'macos-latest', setupSteps(shape, 'macos')),
        `      - run: ${command} --scope ${shape.swiftScope}`,
    ];
}

/**
 * The workflow: one job per platform in [ci] platforms, plus a macOS job when a Swift scope exists.
 * @param shape the version, the platforms, the Swift scope and the task runner
 * @returns the generated file
 */
export function workflowFile(shape: WorkflowShape): GeneratedFile {
    const content = [
        headerFor('gspot.yml', shape.version).trimEnd(),
        'name: gspot',
        'on: [push, pull_request]',
        'permissions:',
        '  contents: read',
        '  security-events: write',
        'jobs:',
        ...shape.platforms.flatMap((platform) => checkJob(shape, platform)),
        ...swiftJob(shape),
        '',
    ].join('\n');
    return { path: '.github/workflows/gspot.yml', content, readOnly: true, kind: 'workflow' };
}
