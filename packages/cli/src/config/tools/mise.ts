import type { InstallationKind } from '#cli/types/configurations.ts';
import { TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

/** The generated project holding each tool-project pin. */
export const TOOL_PROJECT_FILES: Record<InstallationKind, string> = {
    npm: TOOL_PACKAGE_PROJECT,
    python: TOOL_PYTHON_PROJECT,
};
