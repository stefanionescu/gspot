// Line breaks and extglob groups, which EditorConfig sections cannot express.
export const UNREPRESENTABLE_SELECTOR = /[\r\n]|[!+?*@]\(/u;

export const LEADING_GLOBSTARS = /^(?:\*\*\/)+/u;

export const GLOB_GROUPING = /[{}()]/u;
