/** Native calendar values and token kinds at the authored expiry boundary. */
export type PolicyExpiryCase = { name: string; literal: string; syntaxError?: string } & (
    | { valid: true; date: string }
    | { valid: false; date?: never }
);
