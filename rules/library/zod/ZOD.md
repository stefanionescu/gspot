---
layer: library
preset: zod
title: Zod
---

# Zod

## Validate boundaries with Zod

Use Zod to define runtime contracts for data entering or leaving the application. Keep each schema
with the feature that owns the contract. Share browser-safe schemas between forms and server
operations; keep database access, secrets, and authorization checks in server modules.

### Choose supported Zod APIs

Check the installed Zod version and the integrations that consume its schemas, including tRPC, form
resolvers, and schema generators. Use Zod 4 APIs for Zod 4 applications. Confirm Zod 4.5 support
before using `z.compile()`, `z.validate()`, `z.deepPartial()`, `.exactPartial()`, runtime
`z.input()`/`z.output()`, or `z.toZod<T>()`. Follow the
[Zod 4.5 release notes](https://zod.dev/blog/zod-4-5) when changing versions.

- Prefer native format schemas such as `z.email()`, `z.uuid()`, and `z.iso.datetime()` when their
  accepted values match the contract. Use `z.enum()` for existing enum values. Await a promise and
  validate its resolved value instead of introducing the deprecated `z.promise()` API.
- Infer application types from the runtime schema. Use `z.input<typeof Schema>` for values before
  parsing and `z.output<typeof Schema>` or `z.infer<typeof Schema>` for parsed values. Keep form
  defaults and resolver input types consistent when coercion or transforms change the output type.
- When a generated or external type owns the contract, use `z.toZod<ExternalType>()(schema)` in Zod
  4.5 to check exact output-type agreement. An assignability check with
  `satisfies z.ZodType<ExternalType>` can miss extra fields or overly broad schemas. Neither check
  supplies missing runtime validation.
- Use `z.custom<T>()` only with a predicate that establishes the promised type. A type argument
  alone validates nothing. Prefer `z.instanceof()` for class instances and built-in schemas for
  ordinary data.
- Consider `zod/mini` when measured browser bundle size warrants its functional API. Check resolver
  compatibility and locale setup. Keep the chosen API consistent within shared schema modules.

### Parse external input

Validate Route Handler bodies, Server Action arguments, tRPC input, URL values, environment
configuration, persisted browser state, and external service responses at their entry points. Client
validation gives feedback; every server entry point still validates its own input.

- Use `.safeParse()` for expected invalid input and branch on `result.success`. Pass `result.data`
  to the operation. Continuing with the original input loses stripping, defaults, normalization, and
  transformed values. Use `.parse()` when a thrown validation error fits the boundary's error
  handling, such as rejecting invalid startup configuration.
- Use `.safeParseAsync()` or `.parseAsync()` whenever the schema includes asynchronous refinements
  or transforms. A safe parse handles validation issues; it does not catch arbitrary exceptions
  thrown by custom code, failed network requests, or malformed JSON decoding before validation.
- Use Zod 4.5 `z.validate(schema, input)` only when a boolean answer is sufficient. It narrows the
  schema's input type and does not return parsed output or field errors. Use `z.validateAsync()` for
  asynchronous schemas. Keep full parsing wherever the caller needs normalized, stripped, defaulted,
  or transformed data.
- Parse transport syntax separately from the value schema. Handle invalid JSON as a client input
  failure, then validate the decoded value. Preserve the original bytes when webhook verification
  requires them before decoding the authenticated payload.
- Enforce request and upload size limits before buffering large inputs. Add appropriate string,
  collection, nesting, and total-item limits for the operation. A recursive schema or `z.json()`
  does not establish an application's resource budget.
- Validate provider responses before returning them from a query function or caching them. Treat an
  invalid upstream response as an integration failure, with safe diagnostics, rather than reporting
  that the user entered invalid data.

Enforce authorization and database constraints independently of schema validation. A valid
identifier does not prove that the caller may access the identified resource.

### Define objects and patch contracts

Choose the behavior for unknown fields deliberately. `z.object()` removes unrecognized string keys
from the parsed result; `z.strictObject()` rejects them; `z.looseObject()` retains them. Use
`.catchall()` when additional fields have a defined value schema. Strict input contracts are useful
when accepting a misspelled field silently changes the meaning of a write.

- Define the fields that the operation accepts. Derive a patch from an explicit selection of
  editable fields, using `.pick()` where appropriate. Do not expose an entire database row through
  `.partial()` and let callers supply ownership, privilege, or server-managed fields.
- Give omission, `undefined`, and `null` separate meanings. For a patch, an omitted key normally
  leaves the stored value unchanged; an allowed `null` may clear it. `.optional()` permits
  `undefined`; `.nullable()` permits `null`; `.nullish()` permits both.
- In Zod 4.5, use `.exactOptional()` or `.exactPartial()` when absence is allowed but an explicit
  `undefined` must fail. `.exactPartial()` preserves an inner schema's existing acceptance of
  `undefined`; inspect the source fields. JSON cannot carry `undefined`, but direct calls and richer
  transports can expose this distinction.
- Use `.partial()` for changes to the top-level fields. Use Zod 4.5 `z.deepPartial(schema)` only
  when the operation supports nested patches at every affected level. Define how arrays and nested
  objects are replaced or merged; partial validation does not implement those updates.

- The functional API makes discriminators optional and converts discriminated unions to ordinary
  unions. It also rejects objects with their own refinements. Define a dedicated patch schema when
  these changes weaken the contract.
- Avoid defaults that turn an omitted patch field into a write. `.default()` returns an output value
  immediately for `undefined`; `.prefault()` supplies an input value that still passes through
  parsing. Use the latter when the fallback needs trimming or other validation.
- Use `.catch()` only when replacing invalid input is part of the contract, such as recovering a
  display preference. Do not silently turn an invalid mutation, permission value, or required
  configuration into a successful default.
- Project response fields before returning them. Do not rely on loose schemas to remove private
  values.
- Zod 4.5 `z.properties()` validates named properties while preserving the original object; nested
  transform and default results are discarded. Use it for instance checks, not for producing a
  stripped response object.

### Normalize form and URL values

Define normalization in the shared contract so browser feedback and server parsing agree. Treat URL
search parameters and `FormData` as transport values: missing entries, empty strings, repeated keys,
and files need explicit handling before domain code receives them.

- Extract allowed form fields deliberately. Use `getAll()` for repeated values and validate their
  collection shape. Do not flatten repeated values into a single property unintentionally. Keep
  framework form metadata out of a strict domain schema.
- Do not use `z.coerce.boolean()` to interpret the strings `"true"` and `"false"`: JavaScript treats
  both nonempty strings as true. Use `z.stringbool()` with the contract's accepted spellings, or an
  explicit mapping for checkbox presence. Reject unknown spellings instead of guessing.
- Handle empty and absent numeric input before coercion. JavaScript converts `""` and `null` to
  zero; a type parameter on `z.coerce.number<T>()` does not restrict runtime inputs. Validate whole
  numeric strings and apply integer, finite-value, and domain bounds. `parseInt()` can accept a
  numeric prefix followed by invalid text.
- Trim and normalize only where the field contract permits it. Do not silently alter passwords,
  signed tokens, or identifiers whose exact bytes matter. Keep optional blank-string handling
  separate from `.optional()`, which accepts `undefined` rather than an empty string.
- Select URL rules for the use case. `z.url()` accepts schemes beyond HTTP, while `z.httpUrl()`
  restricts web protocols and domain-shaped hosts. Define localhost or IP support separately when
  needed.
- URL format validation does not establish a safe redirect target or authorize a server fetch. Check
  the destination against the operation's permitted targets.

- Distinguish calendar dates, local wall-clock times, and instants. Choose datetime offset and
  precision options explicitly. In Zod 4.5, default `z.iso.datetime()` requires seconds for a `Z` or
  offset-qualified value.
- Use an explicit minute-precision schema when that format is allowed. Do not turn a timezone-less
  value into an instant without the application's timezone policy.

- Match length validation to the product's definition of a character. Zod 4.5 string length checks
  count Unicode code points. JavaScript `.length` counts UTF-16 code units, and a displayed
  character can contain several code points.
- Keep browser counters and server limits consistent; use grapheme segmentation when the requirement
  concerns displayed characters.
- Use `z.file()` for declared size and MIME constraints where supported. Validate actual file
  content separately when required; metadata does not prove the bytes match the declared type.
  Likewise, `z.jwt()`, `z.creditCard()`, and phone formats do not verify signatures, payment
  authorization, or ownership. Keep those checks with the responsible integration.

### Compose schemas and refinements

Keep schema construction outside repeated renders and request loops when it depends only on stable
contract rules. Pass request-specific dependencies explicitly to server validation. Do not capture
the first request's user, tenant, or locale in a shared schema.

- Prefer object composition over intersections when callers need `.pick()`, `.omit()`, or other
  object methods. `.extend()` can overwrite existing fields. Use `.safeExtend()` to preserve object
  refinements and require assignable field replacements. Review the actual validation constraints
  too: assignability alone does not prevent weakening a field.
- Use shape spreading to compose large unrefined objects without long `.extend()` chains. Choose the
  resulting strictness explicitly. Spreading `.shape` does not copy object-level refinements;
  preserve those rules deliberately when deriving a contract.
- Use `z.discriminatedUnion()` for variants with a stable tag. Preserve required discriminators in
  mutation inputs. Use Zod 4.5 `z.getDiscriminatedOption()` when selecting a declared member by its
  tag instead of indexing internal schema definitions.
- Remember that an ordinary union accepts the first successful branch. Use `z.xor()` only when
  exactly one branch must match, and account for overlapping objects whose unknown fields are
  stripped. Prefer a discriminator when it expresses the domain clearly.
- Use `z.record(enumSchema, valueSchema)` for a complete set of enum keys and `z.partialRecord()`
  for sparse entries. Check mixed object/record intersections against the installed version;
  pattern-key behavior changed in Zod 4.5. Cover accepted and rejected keys in contract fixtures.
- Make refinements deterministic and free of writes. Return a failure or add an issue instead of
  throwing. Use `.refine()` for a single condition and `.superRefine()` for several related issues.
  Give cross-field failures the relevant field path so the UI can associate them with a control.
- Use refinement `when` only when the fields the refinement reads have independently passed their
  prerequisite validation. Do not force code to run against an invalid shape to collect more errors.

- Bound asynchronous checks and keep database constraints authoritative for races such as
  simultaneous attempts to claim the same unique value.

- Treat recursive input support separately from transport support. Zod 4.5 can parse cyclic input;
  Zod Mini requires memoizer registration. JSON still cannot serialize cycles, symbols, Maps, or
  Sets directly.
- Declared symbol keys can be validated, but unknown symbol keys are ignored even by strict objects.
  Use an explicit transport shape for responses and persisted state.

### Encode and decode with codecs

Use `z.codec()` when a boundary needs a defined conversion in both directions, such as an ISO
datetime string and a `Date`. Define the transport schema, application schema, decoder, and encoder
together. Keep the existing tRPC transformer and query hydration format consistent with that choice.

- Parse unknown input with `.parse()` or `.safeParse()`. Codec `.decode()` and `z.decode()` perform
  the forward conversion with statically typed inputs; their signatures do not justify casting an
  unchecked network response. Use `.encode()` or `z.encode()` for the reverse conversion.
- Use safe and asynchronous codec variants according to the boundary's failure handling and the
  schema's callbacks. Refinements run in both directions. Defaults, prefaults, and `.catch()` apply
  only in the forward direction.
- Do not put a one-way `.transform()` inside a schema that must support encoding. Encoding through
  it raises a runtime error rather than a validation issue. Define a codec or a separate response
  schema instead.
- In Zod 4.5, runtime `z.input(schema)` and `z.output(schema)` select sides of nested pipes and
  codecs. They are separate from the TypeScript helpers with angle brackets.

- Do not use `z.output()` on an unconstrained one-way transform as proof of output validity; provide
  an explicit output schema. Check wrapper behavior when defaults or prefaults belong to only one
  side of a codec.
- Define the expected round trip. Normalizing a URL or datetime can preserve its meaning without
  preserving its original text.
- Check invalid dates, timezone offsets, numeric overflow, and precision loss when converting
  between numbers and bigints. Keep custom conversion failures inside the validation issue model
  when invalid input is expected.

### Return useful validation errors

Return a stable, serializable error contract from Server Actions and HTTP endpoints. Expose field
paths, safe error codes, and the parameters the UI needs to explain a correction. Preserve form
input after rejection. Keep unexpected server failures separate from invalid user input.

- Use `z.flattenError()` for flat forms and `z.treeifyError()` when nested objects or array indices
  need distinct errors. Flattened errors contain `formErrors` and `fieldErrors`; do not lose
  form-level failures by returning only field errors. Access optional tree branches safely.
- Use `.issues` when building a project-specific error response. Prefer `z.treeifyError()` over
  deprecated formatting APIs. Reserve `z.prettifyError()` for readable diagnostics rather than
  treating its display string as a machine-readable response contract.
- Use the Zod 4 `error` option for custom messages. Refinement/check messages can take precedence
  over schema messages, which take precedence over per-parse, global, and locale error maps. Return
  `undefined` from an error map when the next configured handler decides.
- Translate issues at render time or pass a request-scoped error map when parsing. Error callbacks
  run during parsing.
- Do not call global `z.config()` with each request's locale on a shared server; concurrent requests
  need independent language choices. Apply the same rule to mutable registries and other
  request-specific global configuration.
- Keep `reportInput` disabled for private payloads. Review custom messages and diagnostic context
  too, because interpolating a field value can reveal it without that option. Send a safe projection
  of issues instead of an entire error object or stack trace.

### Publish schemas and metadata

Use `z.toJSONSchema()` when an API description, form generator, or structured-output integration
needs JSON Schema. Set the target dialect for the consumer. Select `io: "input"` for accepted
request values; the default conversion describes output. Continue validating actual data with the
runtime schema, including custom refinements that the exported schema cannot express.

- Keep failures for unrepresentable types visible. Dates, bigints, Maps, Sets, and custom transforms
  often need a separate transport schema. Do not apply `unrepresentable: "any"` broadly to make
  generation pass while silently removing constraints. Make each supported conversion explicit.
- Treat `z.fromJSONSchema()` as experimental. Check its installed behavior and supported keywords;
  conversion does not establish equivalence with every original validation rule.
- Attach stable documentation metadata with `.meta()`. Metadata can override generated JSON Schema
  keywords, so review structural overrides as contract changes. Keep secrets and request-specific
  values out of metadata and shared registries.
- Retain the schema instance returned by `.meta()` or `.describe()`. Metadata belongs to that
  instance and may not survive a later schema derivation. `.register()` instead updates a registry
  and returns the existing schema. Give registered IDs unique, stable values, and register every
  schema intended for registry-based export.
- Verify generated required fields, unknown-field behavior, nullability, and references against
  representative request and response values. Regenerate affected artifacts when the contract
  changes and check the actual consumer's supported dialect and formats.

### Compile frequently used schemas

Use Zod 4.5 compilation when validation measurements justify it. Compile a reusable schema once
after its final derivation; `.extend()`, `.refine()`, and similar operations return uncompiled
schemas. Keep callbacks pure: failed compiled parses can run refinements and transforms twice.

- Unsupported schemas can fall back without compiling. Async parsing and encoding use the normal
  parser. Use `strict: true` during verification when compilation itself is a requirement.
- Compilation uses `new Function()`. Verify CSP and deployment restrictions; preserve those
  protections. Global compilation respects `jitless`, while direct compilation attempts code
  generation and can fall back when blocked.
- Use `import "zod/compile"` only from an application-owned entry point, before modules construct
  schemas. It compiles later schemas on first use. Check server and browser entry points separately;
  a shared library never enables global compilation for its consumers.
- Measure bundle size, initialization, and representative successful and failed parses. Compiler
  code increases the bundle, and failures still need the standard parser. Confirm the expected
  output and issue behavior in the deployed runtime.

See [Zod compilation](https://zod.dev/compile) for supported schemas and fallback behavior.

### Verify Zod upgrades

Review affected contracts when upgrading, including a minor release with stricter validation. Use
representative boundary fixtures for forms, endpoints, persistence, and provider payloads. For Zod
4.5, check:

- Datetimes with omitted seconds, explicit offsets, or local values.
- Emoji, combining marks, and other non-ASCII strings near length limits.
- Omitted fields, explicit `undefined`, defaults, and partial update behavior.
- Pattern-keyed records, object intersections, and unknown fields.
- Real ULIDs, IPv6 addresses, and web hostnames accepted by integrations.
- Reserved property names, including `__proto__`, and the shape of returned validation errors.

Zod 4.5 strips `__proto__` from object and record parsing, including normalized record keys; strict
objects report an own input key as unrecognized. Keep ordinary safe object handling in downstream
code. Parser hardening does not authorize arbitrary keys or make unchecked merges safe.

## References

Use documentation matching the installed release and enabled features.

| Topic                         | Primary source                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Zod version-specific behavior | [Zod 4.5 release notes](https://zod.dev/blog/zod-4-5)                                                               |
| Zod parsing and schemas       | [Basic usage](https://zod.dev/basics) and [Schema API](https://zod.dev/api)                                         |
| Zod error handling            | [Customizing errors](https://zod.dev/error-customization) and [Formatting errors](https://zod.dev/error-formatting) |
| Zod transport conversions     | [Codecs](https://zod.dev/codecs)                                                                                    |
| Zod published contracts       | [JSON Schema](https://zod.dev/json-schema) and [Metadata](https://zod.dev/metadata)                                 |
| Zod compilation and fallback  | [AOT compilation](https://zod.dev/compile)                                                                          |
