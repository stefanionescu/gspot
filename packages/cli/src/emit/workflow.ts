import { stringify } from 'yaml';
// GitHub workflows and GitLab includes share installation and exact-object selection.
import { headerFor } from '#cli/emit/templates.ts';
import { releaseTargets } from '#cli/platform/release-targets.ts';
import type { GeneratedFile, WorkflowShape } from '#cli/types/generation.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/emit/runner-tasks.ts';

const CHECKOUT = 'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5';
const MISE = 'jdx/mise-action@5ac50f778e26fac95da98d50503682459e86d566';
const SARIF = 'github/codeql-action/upload-sarif@df5a14dc28094dc936e103b37d749c6628682b60';
const UPLOAD = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02';
const DOWNLOAD = 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093';
const CACHE = 'actions/cache@5a3ec84eff668545956fd18022155c47e93e2684';
const RELEASES = 'https://github.com/stefanionescu/gspot/releases/download';

const RUNNERS: Record<string, string> = { ubuntu: 'ubuntu-24.04', macos: 'macos-15', windows: 'windows-2025' };

const ASSET_CASES = releaseTargets
    .filter((target) => target.os !== 'win32')
    .map((target) => {
        const system = target.os === 'darwin' ? 'Darwin' : 'Linux';
        const architecture = target.cpu === 'x64' ? 'x86_64' : target.os === 'darwin' ? 'arm64' : 'aarch64';
        return `    ${system}-${architecture}-${target.libc ?? 'none'}) asset=${target.binary} ;;`;
    });

// uname prints x86_64 and aarch64; the release assets end in x64 and arm64, so the step maps one to the other and verifies the checksum.
function unixInstallCommands(version: string, directory: string): string[] {
    const base = `${RELEASES}/v${version}`;
    return [
        `mkdir -p "${directory}"`,
        'system="$(uname -s)"',
        'architecture="$(uname -m)"',
        'libc=none',
        'if [[ ${system} == Linux ]]; then',
        '    if description="$(getconf GNU_LIBC_VERSION 2>/dev/null)" && [[ ${description} == glibc* ]]; then',
        '        libc=glibc',
        '    else',
        '        description="$(ldd --version 2>&1)" || :',
        '        case "${description}" in',
        '            *musl*) libc=musl ;;',
        '            *)',
        '                echo "Cannot identify the Linux C library." >&2',
        '                exit 2',
        '                ;;',
        '        esac',
        '    fi',
        'fi',
        'case "${system}-${architecture}-${libc}" in',
        ...ASSET_CASES.map((line) => `    ${line.trimStart()}`),
        '    *)',
        '        echo "gspot has no build for this runner" >&2',
        '        exit 2',
        '        ;;',
        'esac',
        `curl -fsSL "${base}/\${asset}" -o "${directory}/gspot"`,
        `curl -fsSL "${base}/checksums.txt" -o "${directory}/checksums.txt"`,
        `expected="$(awk -v asset="\${asset}" '$2 == asset { print $1 }' "${directory}/checksums.txt")"`,
        'if command -v sha256sum >/dev/null 2>&1; then',
        `    actual="$(sha256sum "${directory}/gspot")"`,
        'else',
        `    actual="$(shasum -a 256 "${directory}/gspot")"`,
        'fi',
        'actual="${actual%% *}"',
        'if [[ -z ${expected} || ${expected} != "${actual}" ]]; then',
        '    echo "The gspot checksum does not match." >&2',
        '    exit 1',
        'fi',
        `chmod 0755 "${directory}/gspot"`,
        `export PATH="${directory}:\${PATH}"`,
    ];
}

function unixInstall(version: string): string[] {
    return [
        '      - name: Install gspot',
        '        shell: bash',
        '        run: |',
        ...unixInstallCommands(version, '${RUNNER_TEMP}/gspot-bin').map((line) => `          ${line}`),
        '          echo "${RUNNER_TEMP}/gspot-bin" >> "${GITHUB_PATH}"',
    ];
}

function windowsInstall(version: string): string[] {
    const base = `${RELEASES}/v${version}`;
    return [
        '      - name: Install gspot',
        '        shell: pwsh',
        '        run: |',
        `          $asset = '${releaseTargets.find((target) => target.os === 'win32')!.binary}'`,
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
    if (shape.isMise)
        return [
            `      - uses: ${MISE} # v3.2.0`,
            '        with:',
            `          version: "${MISE_MIN_VERSION}"`,
            '          cache: false',
            '      - run: mise exec -- gspot install',
        ];
    const install = platform === 'windows' ? windowsInstall(shape.version) : unixInstall(shape.version);
    return [...install, '      - run: gspot install', '      - run: gspot doctor'];
}

function comparisonCheck(command: string, isFull: boolean): string {
    if (isFull) return command;
    return [
        'base="${GSPOT_CI_BASE:-}"',
        'case "${base}" in',
        `    '' | 0000000000000000000000000000000000000000 | 0000000000000000000000000000000000000000000000000000000000000000) ${command} ;;`,
        '    *)',
        '        if [[ ! ${base} =~ ^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$ ]]; then',
        '            echo "Invalid CI comparison object" >&2',
        '            exit 2',
        '        fi',
        '        git cat-file -e "${base}^{commit}"',
        '        target="$(git rev-parse --verify HEAD)"',
        `        printf 'refs/heads/ci %s refs/heads/ci %s\\n' "\${target}" "\${base}" | ${command} --push -- origin ''`,
        '        ;;',
        'esac',
    ].join('\n');
}

function checkJob(shape: WorkflowShape, platform: string, stage: 'check' | 'manual'): string[] {
    const command = shape.isMise ? 'mise run gspot:check --' : 'gspot check';
    const selected = stage === 'manual' ? `${command} --stage manual` : comparisonCheck(command, shape.run === 'all');
    return [
        `  ${stage}-${platform}:`,
        `    runs-on: ${RUNNERS[platform]}`,
        '    timeout-minutes: 30',
        ...(stage === 'manual'
            ? [
                  "    if: github.event_name == 'push' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)",
              ]
            : []),
        '    defaults:',
        '      run:',
        '        shell: bash',
        '    steps:',
        `      - uses: ${CHECKOUT} # v4.3.1`,
        '        with:',
        '          fetch-depth: 0',
        '          persist-credentials: false',
        `      - uses: ${CACHE} # v4.2.3`,
        '        with:',
        "          key: gspot-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('.gspot/package.json', '.gspot/*lock*', '.gspot/pyproject.toml', '.mise/conf.d/gspot-tools.toml', '.gspot/version') }}",
        '          path: |',
        '            ~/.npm/_cacache',
        '            ~/.bun/install/cache',
        '            ~/.cache/uv',
        '            ~/.cache/mise',
        '            ~/.local/share/mise/installs',
        '            ~/.local/share/pnpm/store',
        '            ~/.yarn/berry/cache',
        ...setupSteps(shape, platform),
        '      - name: Check',
        ...(stage === 'manual'
            ? []
            : [
                  '        env:',
                  "          GSPOT_CI_BASE: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event_name == 'merge_group' && github.event.merge_group.base_sha || github.event.before }}",
              ]),
        '        run: |',
        ...selected.split('\n').map((line) => `          ${line}`),
        `      - uses: ${UPLOAD} # v4.6.2`,
        '        if: always() && !cancelled()',
        '        with:',
        `          name: gspot-${stage}-${platform}`,
        '          retention-days: 14',
        '          include-hidden-files: true',
        '          if-no-files-found: warn',
        '          path: |',
        '            .gspot/reports/report.json',
        '            .gspot/reports/report.sarif',
        '            .gspot/reports/report.codequality.json',
    ];
}

function scanJob(jobs: string[]): string[] {
    return [
        '  code-scanning:',
        `    needs: [${jobs.join(', ')}]`,
        "    if: always() && !cancelled() && github.event_name == 'push' && !github.event.repository.fork",
        '    runs-on: ubuntu-24.04',
        '    timeout-minutes: 10',
        '    permissions:',
        '      contents: read',
        '      security-events: write',
        '      actions: read',
        '    steps:',
        `      - uses: ${CHECKOUT} # v4.3.1`,
        '        with:',
        '          persist-credentials: false',
        `      - uses: ${DOWNLOAD} # v4.3.0`,
        '        with:',
        '          pattern: gspot-*',
        '          path: reports',
        ...jobs.flatMap((job) => [
            `      - name: Upload ${job} SARIF`,
            `        if: always() && !cancelled() && hashFiles('reports/gspot-${job}/report.sarif') != ''`,
            `        uses: ${SARIF} # v3.25.0`,
            '        with:',
            `          sarif_file: reports/gspot-${job}/report.sarif`,
            `          category: gspot-${job}`,
        ]),
        '      - name: Report absent SARIF files',
        '        if: always() && !cancelled()',
        '        shell: bash',
        '        run: |',
        ...jobs.map(
            (job) =>
                `          if [[ ! -f "reports/gspot-${job}/report.sarif" ]]; then echo "::notice::No SARIF artifact from ${job}. Check its setup and check result."; fi`,
        ),
    ];
}

/**
 * Generate independent check and manual jobs with retained reports and restricted scanning permissions.
 * @param shape
 */
export function workflowFile(shape: WorkflowShape): GeneratedFile {
    const platforms = [...new Set([...shape.platforms, ...(shape.swiftScope === undefined ? [] : ['macos'])])];
    const jobs = platforms.flatMap((platform) => ['check', 'manual'].map((stage) => `${stage}-${platform}`));
    const content = [
        headerFor('gspot.yml', shape.version).trimEnd(),
        'name: gspot',
        'on: [push, pull_request, merge_group]',
        'permissions:',
        '  contents: read',
        'concurrency:',
        "  group: gspot-${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
        "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
        'jobs:',
        ...platforms.flatMap((platform) => [
            ...checkJob(shape, platform, 'check'),
            ...checkJob(shape, platform, 'manual'),
        ]),
        ...(shape.sarif === false ? [] : scanJob(jobs)),
        '',
    ].join('\n');
    return { path: '.github/workflows/gspot.yml', content, readOnly: true, kind: 'workflow' };
}

/**
 * Generate a GitLab include without changing the authored pipeline.
 * @param shape
 */
export function gitlabFile(shape: WorkflowShape): GeneratedFile {
    const command = shape.isMise ? 'mise exec -- gspot' : 'gspot';
    const setup = shape.isMise
        ? [`mise trust ${MISE_CONFIG_PATH}`, 'mise install']
        : [
              'gspot_directory="$(mktemp -d)"',
              'trap \'rm -rf "${gspot_directory}"\' EXIT',
              ...unixInstallCommands(shape.version, '${gspot_directory}'),
          ];
    const check = [
        'GSPOT_CI_BASE="${CI_MERGE_REQUEST_DIFF_BASE_SHA:-${CI_COMMIT_BEFORE_SHA:-}}"',
        comparisonCheck(`${command} check`, shape.run === 'all'),
    ].join('\n');
    const path = '.gitlab/ci/gspot.yml';
    const content = stringify({
        gspot: {
            stage: 'test',
            timeout: '30m',
            variables: { GIT_DEPTH: '0' },
            rules: [
                { if: '$CI_PIPELINE_SOURCE == "merge_request_event"', interruptible: true },
                { if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH', interruptible: false },
            ],
            script: ['set -euo pipefail', ...setup, `${command} install`, `${command} doctor`, check],
            artifacts: {
                when: 'always',
                expire_in: '14 days',
                paths: [
                    '.gspot/reports/report.json',
                    '.gspot/reports/report.sarif',
                    '.gspot/reports/report.codequality.json',
                ],
                reports: { codequality: '.gspot/reports/report.codequality.json' },
            },
        },
    });
    return { path, content: `${headerFor(path, shape.version)}${content}`, readOnly: true, kind: 'workflow' };
}
