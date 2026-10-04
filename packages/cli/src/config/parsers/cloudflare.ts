export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;

export const STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308', '404', '410']);

export const REDIRECT_PARTS = { least: 2, most: 3 };
