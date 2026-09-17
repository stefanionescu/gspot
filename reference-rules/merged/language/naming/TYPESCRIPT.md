# TypeScript Naming

TypeScript naming follows the project rules here. Google TypeScript guidance is
a strong default for many language choices. The rules below deliberately override some of it, and
say so where they do.

Project decisions:

- Use `kebab-case` filenames for TypeScript source files.
- Use `type` aliases for object shapes by default.
- Do not adopt Google's blanket interface preference.
- Do not adopt Basarat's camelCase filename preference.
- Named exports are preferred for app code.
- Default exports are allowed only where ecosystem config files or frameworks
  require them.
- Prefix intentionally unused parameters or variables with `_` when needed.
- Do not introduce broad naming-lint policy changes outside an explicit
  quality-rule task.

## TypeScript Case Rules

Rules:

- Type aliases, classes, interfaces used for framework contracts, React
  components, decorators, and constructor values use `PascalCase`.
- Do not introduce TypeScript enums; if external or generated code exposes an
  enum-like type, keep its required contract name and isolate it at the
  boundary.
- Functions, methods, variables, parameters, properties, module aliases, and
  local values use `camelCase`.
- Global constants and static readonly constants may use `UPPER_SNAKE_CASE`
  when the value is intended to be fixed and conventionally constant.
- Do not use leading or trailing underscores except intentionally unused
  parameters or variables.
- Do not prefix interfaces with `I`.
- Type parameters may use a single clear uppercase letter or a descriptive
  `PascalCase` name.
- Treat abbreviations as words unless the platform name requires otherwise:
  `parseHttpUrl`, not `parseHTTPURL`, but `XMLHttpRequest` remains a platform
  name.

Bad:

```ts
interface IUserRepository {}
type user_profile = {};
const DAYS_IN_WEEK = 7;
const daysInMonth = 30;
function restore_database() {}
const URLValue = 'https://example.com';
```

Good:

```ts
type UserProfile = {};
type UserRepository = {
    getUser(userId: UserId): Promise<User>;
};

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;

function restoreDatabase() {}
const urlValue = 'https://example.com';
```

## TypeScript Files and Modules

Rules:

- TypeScript source filenames use `kebab-case`.
- File names describe the primary exported type, function, route, or cohesive
  capability.
- Do not use namespaces, `module`, triple-slash references, or
  `import x = require(...)` to simulate ownership.
- Use file scope and named exports instead of static container classes.
- Do not create files named only for generic reuse.
- Keep generated file names only when generator-owned.

Bad:

```text
UserService.ts
userHelpers.ts
utils.ts
samples.ts
ReportReaderContainer.ts
```

Good:

```text
user-repository.ts
email-address-validation.ts
session-token-verifier.ts
report-reader.ts
submit-order-route.ts
```

Bad:

```ts
export default class Container {
    static FOO = 1;

    static bar() {
        return 1;
    }
}
```

Good:

```ts
export const FOO = 1;

export function bar(): number {
    return 1;
}
```

## TypeScript Variables

Rules:

- Use meaningful, pronounceable names.
- Use the same vocabulary for the same concept.
- Use explanatory destructuring names.
- Avoid mental mapping with single-letter names except tiny local scopes.
- Use named constants for meaningful repeated numbers or strings.
- Do not add context already present in the type or owner.

Bad:

```ts
function between<T>(a1: T, a2: T, a3: T): boolean {
    return a2 <= a1 && a1 <= a3;
}

declare const users: Map<string, User>;
for (const keyValue of users) {
    ...
}
```

Good:

```ts
function between<T>(value: T, left: T, right: T): boolean {
    return left <= value && value <= right;
}

declare const users: Map<string, User>;
for (const [userId, user] of users) {
    ...
}
```

Bad:

```ts
setTimeout(restart, 86_400_000);
```

Good:

```ts
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

setTimeout(restart, MILLISECONDS_PER_DAY);
```

## TypeScript Functions

Rules:

- Function names say what they do.
- Prefer two or fewer parameters.
- Use an options object for many arguments, multiple same-type arguments,
  optional groups, or boolean flags.
- Do not use boolean flags to choose separate behaviors.
- Prefer a positive predicate name plus `!` at the call site over a negative
  predicate function.
- Use async/await in names only when distinguishing from a blocking counterpart
  is necessary. Normally the return type communicates async.
- Name functions by domain work, not implementation mechanics.

Bad:

```ts
function createFile(name: string, temp: boolean) {
    if (temp) {
        fs.create(`./temp/${name}`);
    } else {
        fs.create(name);
    }
}
```

Good:

```ts
function createTempFile(name: string) {
    createFile(`./temp/${name}`);
}

function createFile(name: string) {
    fs.create(name);
}
```

Bad:

```ts
function createMenu(title: string, body: string, buttonText: string, cancellable: boolean) {
    ...
}
```

Good:

```ts
type MenuOptions = {
    title: string;
    body: string;
    buttonText: string;
    isCancellable: boolean;
};

function createMenu(options: MenuOptions) {
    ...
}
```

## TypeScript Types

Rules:

- Use `type` aliases for object shapes by default.
- Use unions and discriminated unions for alternatives.
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes an interface the clearest tool.
- Do not encode optionality in an alias name.
- Use optional fields and parameters for values that may be omitted.
- Avoid return-type-only generics. When using an existing return-type-only
  generic API, specify the generic explicitly.
- Avoid `any`; use a specific type or `unknown` with narrowing.
- Name index keys meaningfully if an index signature is needed.
- Prefer `Map` when key/value behavior is the point.

Bad:

```ts
type CoffeeResponse = Latte | Americano | undefined;

type Users = {
    [key: string]: User;
};

function nicestElement<T>(): T {
    ...
}
```

Good:

```ts
type CoffeeResponse = Latte | Americano;

function getCoffeeResponse(): CoffeeResponse | undefined {
    ...
}

type UsersById = {
    [userId: string]: User;
};

function nicestElement<T>(items: readonly T[]): T {
    ...
}
```

## TypeScript Runtime Boundaries

Rules:

- Preserve external field names in DTOs and validation schemas.
- Name parsed or validated values as trusted domain values after validation.
- Do not rename external fields just to make validation code look idiomatic if
  the runtime contract still uses the external name.
- Use explicit conversion names for DTO-to-domain mapping.

Bad:

```ts
const request = req.body as SubmitOrderRequest;
```

Good:

```ts
const submitOrderRequest = parseSubmitOrderRequest(req.body);
```

Bad:

```ts
type ProviderResponse = {
    providerOperationId: string;
    providerStatus: string;
};
```

Good:

```ts
type ProviderSubmitOrderResponse = {
    providerOperationId: string;
    providerStatus: string;
};
```

