// Positions whose parent always takes a function value.
export const VALUE_PARENTS = new Set<string>(['ReturnStatement', 'JSXExpressionContainer', 'ArrowFunctionExpression']);

/** Two reads establish reuse within the current module. */
export const SHARED_READS = 2;

export const EXPORT_REFERENCES = new Set(['ExportSpecifier', 'ExportDefaultDeclaration', 'TSExportAssignment']);
