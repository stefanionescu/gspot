// The literal values checks/platform/cloudflare reads: names, patterns, limits, and tables.

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308', '404', '410']);
export const COMPATIBILITY_DATE = /^\d{4}-\d{2}-\d{2}$/u;
export const TYPES_FILE = 'cloudflare-env.d.ts';
export const REDIRECT_PARTS = { least: 2, most: 3 };
