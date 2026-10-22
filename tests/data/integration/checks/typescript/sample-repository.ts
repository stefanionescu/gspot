// The entry may import the orders, and the orders only each other.
export const ARCHITECTURE_SETTINGS = `
[[import_rule]]
name = "orders"
paths = ["src/orders/**"]

[[import_rule]]
name = "entry"
paths = ["src/main.ts"]
`;
