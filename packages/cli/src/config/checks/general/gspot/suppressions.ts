export const REASON_ABOVE = /^(?:\/\/|\/\*|#|--|<!--)\s*reason:\s*(?<reason>\S.*)$/u;

export const SUPPRESSION_KIND_MESSAGES = {
    all: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    limit: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
} as const;

export const ISO_DATE_LENGTH = 10;

export const EXPIRED_IGNORE_HELP =
    'Fix the findings and delete the ignore with gspot unignore. To keep it, write a later until date in gspot.toml.';
