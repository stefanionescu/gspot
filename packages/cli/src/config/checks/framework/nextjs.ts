const NEXT_CONFIG = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;

const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;

const SHOWN_LINES = 3;

// The marked line and the one after it.
const MARKED_LINES = 2;

const DISABLED_CHECKS = new Set(['ignoreDuringBuilds', 'ignoreBuildErrors']);

const SECRET_NAME = /^(?=[A-Z\d_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY))[A-Z][A-Z\d_]*$/u;

const NEXT_TYPEGEN_COMMAND = ['next', 'typegen'] as const;
const CI_ENVIRONMENT = { CI: '1' } as const;

export {
    NEXT_CONFIG,
    CAUSE_MARKS,
    SHOWN_LINES,
    SECRET_NAME,
    MARKED_LINES,
    CI_ENVIRONMENT,
    DISABLED_CHECKS,
    NEXT_TYPEGEN_COMMAND,
};
