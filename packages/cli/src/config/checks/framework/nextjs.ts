export const NEXT_COMMAND = 'next';

export const NEXT_BUILD_ACTION = 'build';

export const SEGMENT_NAME = /^(?<kind>page|route)\.[jt]sx?$/u;

export const NEXT_CONFIG = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;

export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;

export const SHOWN_LINES = 3;

// The marked line and the one after it.
export const MARKED_LINES = 2;

export const DISABLED_CHECKS = new Set(['ignoreDuringBuilds', 'ignoreBuildErrors']);

export const SECRET_NAME = /^(?=[A-Z\d_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY))[A-Z][A-Z\d_]*$/u;

export const NEXT_TYPEGEN_COMMAND = [NEXT_COMMAND, 'typegen'] as const;
export const CI_ENVIRONMENT = { CI: '1' } as const;

export const APP_FOLDER = '/app/';

export const NEXT_BUILD_COMMAND = [NEXT_COMMAND, NEXT_BUILD_ACTION] as const;

export const NEXT_PACKAGE_RUNNERS = ['npx', 'bunx'] as const;
export const NEXT_RUN_WORDS = ['exec', 'dlx', NEXT_COMMAND] as const;
