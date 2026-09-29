---
layer: library
kit: zod
title: Zod
---

# Zod

Runtime contracts for data entering or leaving the application. Each schema lives with the
feature that owns the contract. Browser-safe schemas are shared between forms and server
operations, and database access, secrets, and authorization stay in server modules. `tsc`
reports a type that drifts from its schema, and the ESLint TypeScript rules report an unsafe
cast around a parse. This guide holds the boundary decisions no rule can see.

Check the installed Zod release and the integrations that consume its schemas: tRPC, form
resolvers, and schema generators. Confirm 4.5 support before `z.compile()`, `z.validate()`,
`z.deepPartial()`, `.exactPartial()`, runtime `z.input()` and `z.output()`, or `z.toZod<T>()`.
See the [Zod 4.5 release notes](https://zod.dev/blog/zod-4-5) and the
[schema API](https://zod.dev/api).

## APIs and parsing

Native format schemas (`z.email()`, `z.uuid()`, `z.iso.datetime()`) serve where their accepted
values match the contract, and `z.enum()` wraps existing enum values. A promise is awaited and
its value validated rather than wrapped in the deprecated `z.promise()`. Application types
are inferred from the runtime schema: `z.input<typeof Schema>` before parsing, `z.output` or
`z.infer` after. They stay consistent with form defaults and resolver inputs when coercion
changes the output.

When a generated or external type owns the contract, `z.toZod<ExternalType>()(schema)` checks
exact output agreement, because `satisfies z.ZodType<ExternalType>` misses extra fields and
overly broad schemas. Neither adds runtime validation. `z.custom<T>()` needs a predicate that
establishes the type, and `z.instanceof()` covers class instances. `zod/mini` is adopted only
on measured bundle size, after resolver and locale compatibility are checked.

Route Handler bodies, Server Action arguments, tRPC input, URL values, environment
configuration, persisted browser state, and external service responses are validated at their
entry points. Client validation gives feedback, and every server entry validates again.
`.safeParse()` handles expected invalid input, branching on `result.success` and passing
`result.data` onward. The original input lacks stripping, defaults, normalization, and
transforms. `.parse()` fits a boundary where a thrown error is the right handling, such as
invalid startup configuration.

Async refinements or transforms need the async variants. A safe parse catches validation
issues only, not exceptions from custom code, network calls, or JSON decoding. `z.validate()`
answers a boolean and returns no parsed output or field errors. Transport syntax parses
separately from the value schema: invalid JSON is a client input failure, and original bytes
are preserved where webhook verification needs them.

Request and upload size limits apply before buffering. String, collection, nesting, and item
limits match the operation, because a recursive schema or `z.json()` sets no resource
budget. An invalid provider response is an integration failure with safe diagnostics, never
reported as user error. Authorization and database constraints hold independently of
validation: a valid identifier proves no access.

## Objects, patches, and normalization

Unknown-field behavior is chosen deliberately. `z.object()` strips unrecognized keys,
`z.strictObject()` rejects them, `z.looseObject()` keeps them, and `.catchall()` types them.
Strict input protects a write whose meaning a misspelled field silently changes. A patch
derives from an explicit `.pick()` of editable fields, never `.partial()` over a whole row
that lets callers set ownership, privilege, or server-managed fields. Omission, `undefined`,
and `null` carry separate meanings (`.optional()`, `.nullable()`, `.nullish()`). An omitted
patch key leaves the stored value unchanged, and `.exactOptional()` or `.exactPartial()` fail
an explicit `undefined` where only absence is allowed.

`z.deepPartial()` applies only when nested patches are supported at every level, and array
and object merge behavior is defined separately. It makes discriminators optional, turns
discriminated unions into ordinary unions, and rejects refined objects. A dedicated patch
schema replaces it when those changes weaken the contract.

`.default()` returns an output at
once and `.prefault()` supplies an input that still parses; neither turns an omitted patch
field into a write. `.catch()` replaces invalid input only when that is the contract, such as
a display preference, never for a mutation, permission, or required configuration. Response
fields are projected before return, not stripped by a loose schema. `z.properties()` checks
instances without producing a stripped object.

Normalization lives in the shared contract so browser feedback and server parsing agree. URL
search parameters and `FormData` are transport values. Allowed fields are extracted
deliberately, repeated values are read through `getAll()` and validated as collections, and
framework metadata stays out of a strict schema. `z.coerce.boolean()` treats `"false"` as
true, so `z.stringbool()` or an explicit checkbox mapping interprets accepted spellings and
rejects the rest. Empty and absent numeric input is handled before coercion, because `""` and
`null` become zero and a type parameter restricts nothing at runtime. Numeric strings are
validated whole with integer, finite, and domain bounds.

Trimming applies only where the field permits it, never to passwords, signed tokens, or
exact-byte identifiers. Blank-string handling is distinct from `.optional()`. `z.url()`
accepts any scheme, and `z.httpUrl()` web protocols with domain-shaped hosts. Localhost and
IP support is declared separately, and no URL format check authorizes a redirect or server
fetch. Calendar dates, wall-clock times, and instants are distinct, and offset and precision
options are explicit. A timezone-less value never becomes an instant without the timezone policy,
and 4.5 `z.iso.datetime()` requires seconds on an offset value.

String length counts code points in 4.5 while `.length` counts UTF-16 units. Browser counters
and server limits agree, and grapheme segmentation serves displayed characters. `z.file()`
declares size and MIME constraints without proving the bytes. `z.jwt()`, `z.creditCard()`,
and phone formats verify no signature, payment, or ownership.

## Composition, codecs, and errors

Schema construction that depends only on stable rules stays out of renders and request
loops. Request-specific dependencies (user, tenant, locale) are passed explicitly rather than
captured in a shared schema. Object composition beats intersections where `.pick()` and
`.omit()` are needed. `.extend()` overwrites fields, and `.safeExtend()` preserves refinements
and requires assignable replacements, though assignability alone does not prevent weakening a
constraint. Spreading `.shape` composes large unrefined objects, with strictness chosen
explicitly and object-level refinements re-added.

`z.discriminatedUnion()` serves tagged variants. Discriminators stay required in mutation
inputs, and `z.getDiscriminatedOption()` selects a member by tag. An ordinary union takes the
first matching branch, and `z.xor()` demands exactly one, with overlapping stripped objects in
mind. `z.record(enumSchema, valueSchema)` covers a complete key set and `z.partialRecord()`
sparse entries, with pattern-key behavior verified against the installed version.

Refinements are deterministic, write nothing, and add issues rather than throw. `.refine()`
serves one condition and `.superRefine()` related issues, with cross-field failures on the
relevant path. `when` is used only after prerequisite fields have validated independently.
Async checks are bounded, and the database stays authoritative for uniqueness races. Cyclic
input parses in 4.5, with memoizer registration in Mini, but JSON still carries no cycles,
symbols, Maps, or Sets. Unknown symbol keys pass even strict objects, so responses and
persisted state use an explicit transport shape.

`z.codec()` defines both directions of a boundary conversion, such as an ISO string and a
`Date`. Transport schema, application schema, decoder, and encoder are defined together, and
the tRPC transformer and hydration format stay consistent. Unknown input goes through
`.parse()` or `.safeParse()`. Codec `.decode()` takes statically typed input and justifies no
cast of a network response, and `.encode()` reverses. Refinements run both ways; defaults,
prefaults, and `.catch()` only forward.

A one-way `.transform()` inside an encodable schema raises at runtime, so a codec or a
separate response schema replaces it. `z.output()` on an unconstrained transform proves
nothing without an explicit output schema. The expected round trip is defined, because
normalizing a URL or datetime keeps meaning but not text. Invalid dates, offsets, numeric
overflow, and bigint precision are checked, with conversion failures kept inside the issue
model. See [codecs](https://zod.dev/codecs).

Server Actions and endpoints return a stable serializable error contract with field paths,
safe codes, and the parameters the UI needs. Form input is preserved, and unexpected failures
stay apart from invalid input. `z.flattenError()` serves flat forms without dropping
`formErrors`, `z.treeifyError()` nested objects and arrays, `.issues` a project-specific
response, and `z.prettifyError()` diagnostics only. Custom messages use the Zod 4 `error`
option. Refinement messages beat schema messages, which beat per-parse, global, and locale
maps, and a map returns `undefined` to defer.

Issues are translated at render time or through a request-scoped error map, never through
global `z.config()` per request on a shared server. The same holds for mutable registries.
`reportInput` stays off for private payloads, custom messages avoid interpolating field
values, and a safe projection of issues replaces the error object. See
[error customization](https://zod.dev/error-customization).

## Published schemas, compilation, and upgrades

`z.toJSONSchema()` feeds API descriptions, form generators, and structured-output
integrations, with the consumer's dialect and `io: "input"` for accepted request values. The
runtime schema keeps validating what the export cannot express. Unrepresentable types
(dates, bigints, Maps, Sets, custom transforms) get a separate transport schema, never a broad
`unrepresentable: "any"`. `z.fromJSONSchema()` is experimental and proves no equivalence.

`.meta()` attaches stable documentation metadata that can override generated keywords, so
overrides are contract changes and secrets stay out. The returned instance is retained,
because derivation may drop it; `.register()` updates a registry with unique stable IDs.
Generated required fields, unknown-field behavior, nullability, and references are verified
against representative values and regenerated on contract change. See
[JSON Schema](https://zod.dev/json-schema).

Compilation follows measurement. A reusable schema compiles once after its final derivation,
and callbacks stay pure because a failed compiled parse can run them twice. Unsupported
schemas fall back, with `strict: true` where compilation is required, and `new Function()` is
checked against CSP and `jitless`. `import "zod/compile"` belongs to an application-owned
entry point before schemas are built, checked separately for server and browser, never in a
shared library. Bundle size, initialization, and successful and failed parses are measured.
See [compilation](https://zod.dev/compile).

An upgrade, including a minor release with stricter validation, is reviewed against
representative boundary data for forms, endpoints, persistence, and provider payloads. For
4.5, check datetimes with omitted seconds, offsets, or local values, and emoji and combining
marks near length limits. Check omitted fields, explicit `undefined`, defaults, and partial
updates. Check pattern-keyed records, intersections, unknown fields, real ULIDs, IPv6
addresses, and web hostnames. Check reserved names including `__proto__`, which 4.5 strips
from object and record parsing and strict objects report as unrecognized. Parser hardening
does not make unchecked merges safe.
