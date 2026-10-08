import type { Choice, InitAnswers } from '#cli/types/commands/init.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';
import { VERSION_FILE, HOOKS_DIRECTORY, MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';

export const COLUMN_GAP = 2;

export const CONFIGURATION_WIDTH = 16;

export const REASON_WIDTH = 12;

/** The plan row of the hooks folder. */
export const HOOKS_ROW = {
    path: HOOKS_DIRECTORY,
    note: 'gspot install points core.hooksPath here; a repository that already runs hooks gets the lines to add instead',
};

export const CI_SETUP = {
    commands: [`npm install --global "@gspothq/cli@$(cat ${VERSION_FILE})"`, 'gspot install', 'gspot check'],
};

export const JSON_SCHEMA_URL = 'https://generativespotting.com/schema/gspot.schema.json';

export const SCHEMA_LINE = `#:schema ${JSON_SCHEMA_URL}`;

export const TEMPLATE_HEAD = new Set(['template', 'selection', 'configurations']);

export const RUNNER_CHOICES: Choice<InitAnswers['runner']>[] = [
    { value: 'mise', label: `mise (${MISE_CONFIG_PATH})` },
    { value: 'bun', label: 'bun (package.json scripts)' },
    { value: 'npm', label: 'npm (package.json scripts)' },
    { value: 'pnpm', label: 'pnpm (package.json scripts)' },
    { value: 'yarn', label: 'yarn (package.json scripts)' },
    { value: 'none', label: 'none' },
];

export const CI_CHOICES: Choice<InitAnswers['ci']>[] = [
    { value: 'github', label: GITHUB_WORKFLOW },
    { value: 'gitlab', label: `${GITLAB_WORKFLOW} (include from .gitlab-ci.yml)` },
    { value: 'none', label: 'no workflow' },
];

export const ALREADY_INSTALLED =
    'This repository already has a gspot.toml. Run `gspot doctor` to inspect its setup and see suggested commands.\n';

export const DETECTION_LABEL_WIDTH = 20;

// eslint-disable-next-line unicorn/prefer-string-repeat -- reason: Configuration modules own literal display data; rendering performs calculations.
export const DETECTION_GAP = '   ';

export const PREFACE = `${SCHEMA_LINE}

# The policy of this repository under gspot. Every setting has a command that writes it:
# gspot set, ignore, add, remove. Run gspot explain <anything> for what it means.

`;

/** The shared attributes row in every initialization plan. */
export const ATTRIBUTES_ROW = {
    path: '.gitattributes',
    note: 'managed generated-file classification and LF line endings',
};

/** Native SDK roots select the corresponding xcodebuild platform at initialization. */
export const XCODE_DESTINATIONS = new Map<string | undefined, string>([
    ['iphoneos', 'generic/platform=iOS Simulator'],
    ['iphonesimulator', 'generic/platform=iOS Simulator'],
    ['macosx', 'platform=macOS'],
    ['watchos', 'generic/platform=watchOS Simulator'],
    ['watchsimulator', 'generic/platform=watchOS Simulator'],
    ['xros', 'generic/platform=visionOS Simulator'],
    ['xrsimulator', 'generic/platform=visionOS Simulator'],
]);
