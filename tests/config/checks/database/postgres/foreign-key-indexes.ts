export const COMPOSITE_INDEX_CASES = [
    { columns: 'tenant_id, user_id', count: 0 },
    { columns: 'user_id, tenant_id, id', count: 0 },
    { columns: 'tenant_id', count: 1 },
    { columns: 'id, tenant_id, user_id', count: 1 },
    { columns: 'id, tenant_id', count: 1 },
] as const;
