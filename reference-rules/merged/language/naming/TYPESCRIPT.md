---
layer: language
preset: typescript
title: TypeScript Naming
---

# TypeScript Naming

TypeScript naming follows the project rules here. Google TypeScript guidance is
a strong default for many language choices. The rules below deliberately override some of it, and
say so where they do.

Project decisions:

- Use `kebab-case` filenames for TypeScript source files. `enforced-by: naming/identifiers`
- Use `type` aliases for object shapes by default. `unenforced`
- Do not adopt Google's blanket interface preference. `unenforced`
- Do not adopt Basarat's camelCase filename preference. `enforced-by: naming/identifiers`
- Named exports are preferred for app code. `unenforced`
- Default exports are allowed only where ecosystem config files or frameworks
  require them. `unenforced`
- Prefix intentionally unused parameters or variables with `_` when needed. `enforced-by: naming/identifiers`
- Do not introduce broad naming-lint policy changes outside an explicit
  quality-rule task. `unenforced`

## TypeScript case rules

Rules:

- Type aliases, classes, interfaces used for framework contracts, React
  components, decorators, and constructor values use `PascalCase`. `enforced-by: naming/identifiers`
- Do not introduce TypeScript enums; if external or generated code exposes an
  enum-like type, keep its required contract name and isolate it at the
  boundary. `unenforced`
- Functions, methods, variables, parameters, properties, module aliases, and
  local values use `camelCase`. `enforced-by: naming/identifiers`
- A module-level `const` bound to a literal, a frozen object, or an `as const` object is
  `UPPER_SNAKE_CASE`. Every other binding is `camelCase`, including module-level values that
  are computed, and `static readonly` members follow the same split. `enforced-by: naming/identifiers`
- Do not use leading or trailing underscores except intentionally unused
  parameters or variables. `unenforced`
- Do not prefix interfaces with `I`. `enforced-by: naming/identifiers`
- Type parameters may use a single clear uppercase letter or a descriptive
  `PascalCase` name. `enforced-by: naming/identifiers`
- Treat abbreviations as words unless the platform name requires otherwise:
  `parseHttpUrl`, not `parseHTTPURL`, but `XMLHttpRequest` remains a platform
  name. `unenforced`

Bad:

```ts
interface IUserRepository {}
type user_profile = {};
const DAYS_IN_WEEK = 7;
const daysInMonth = 30;
const DEFAULT_CLIENT = createClient();
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
const defaultClient = createClient();

function restoreDatabase() {}
const urlValue = 'https://example.com';
```

## TypeScript files and modules

Rules:

- TypeScript source filenames use `kebab-case`. `enforced-by: naming/identifiers`
- File names describe the primary exported type, function, route, or cohesive
  capability. `enforced-by: naming/identifiers`
- Do not use namespaces, `module`, triple-slash references, or
  `import x = require(...)` to simulate ownership. `unenforced`
- Use file scope and named exports instead of static container classes. `unenforced`
- Do not create files named only for generic reuse. `unenforced`
- Keep generated file names only when generator-owned. `enforced-by: naming/identifiers`
- React component files are kebab-case too: `login-form.tsx` exports `LoginForm`. One rule for
  every file; the export name carries the PascalCase. `enforced-by: naming/identifiers`
- Next.js reserved names are exempt from the stem checks and keep their framework spelling:
  `page`, `layout`, `loading`, `error`, `global-error`, `not-found`, `route`, `template`,
  `default`, `middleware`, `instrumentation`, `[param]`, `[...slug]`, `(group)`, `_private`,
  `@slot`. `unenforced`
- Test files are `<name>.test.ts` or `<name>.test.tsx`, never `.spec`. Directories are
  kebab-case. `enforced-by: naming/identifiers`
- `handle` starts a name only for a React event prop or a framework callback
  (`handleSubmit`, `handleKeyDown`). Never `Handler` as a type suffix. `enforced-by: naming/identifiers`

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

## TypeScript variables

Rules:

- Use meaningful, pronounceable names. `unenforced`
- Use the same vocabulary for the same concept. `unenforced`
- Use explanatory destructuring names. `unenforced`
- Avoid mental mapping with single-letter names except tiny local scopes. `enforced-by: naming/identifiers`
- Use named constants for meaningful repeated numbers or strings. `unenforced`
- Do not add context already present in the type or owner. `unenforced`

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

## TypeScript functions

Rules:

- Function names say what they do. `unenforced`
- Prefer two or fewer parameters. `unenforced`
- Use an options object for many arguments, multiple same-type arguments,
  optional groups, or boolean flags. `unenforced`
- Do not use boolean flags to choose separate behaviors. `unenforced`
- Prefer a positive predicate name plus `!` at the call site over a negative
  predicate function. `unenforced`
- Use async/await in names only when distinguishing from a blocking counterpart
  is necessary. Normally the return type communicates async. `unenforced`
- Name functions by domain work, not implementation mechanics. `unenforced`

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

## TypeScript types

Rules:

- Use `type` aliases for object shapes by default. `unenforced`
- Use unions and discriminated unions for alternatives. `unenforced`
- Use interfaces only when a framework contract, declaration merging, or
  `implements` relationship makes an interface the clearest tool. `unenforced`
- Do not encode optionality in an alias name. `unenforced`
- Use optional fields and parameters for values that may be omitted. `unenforced`
- Avoid return-type-only generics. When using an existing return-type-only
  generic API, specify the generic explicitly. `unenforced`
- Avoid `any`; use a specific type or `unknown` with narrowing. `unenforced`
- Name index keys meaningfully if an index signature is needed. `unenforced`
- Prefer `Map` when key/value behavior is the point. `unenforced`

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

## TypeScript runtime boundaries

Rules:

- Preserve external field names in DTOs and validation schemas. `unenforced`
- Name parsed or validated values as trusted domain values after validation. `unenforced`
- Do not rename external fields just to make validation code look idiomatic if
  the runtime contract still uses the external name. `unenforced`
- Use explicit conversion names for DTO-to-domain mapping. `unenforced`

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
