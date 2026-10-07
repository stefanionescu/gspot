import type { InstallationKind } from '#cli/types/configurations.ts';
import { TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

export const MISE_MIN_VERSION = '2026.8.8';

/** The npm backend that installs the published CLI. */
export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

/** The generated project holding each private acquisition pin. */
export const PRIVATE_PIN_FILES: Record<InstallationKind, string> = {
    npm: TOOL_PACKAGE_PROJECT,
    python: TOOL_PYTHON_PROJECT,
};
