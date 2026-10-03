---
title: Express
---

# Express

Routes, middleware, errors, and body parsing in an Express service, on top of the HTTP rules.

## Routes and middleware

<!-- level: all -->

Express requires no layout, schema library, or response envelope. Use the contracts the project
already has instead of adding competing ones. A route is an HTTP adapter: middleware validates and
authenticates, and the route makes one domain call and sends its result.

```ts
// Bad: the route validates by hand, queries the database, and relays a provider response.
router.post('/orders', async (req, res) => {
    const { accountId, itemIds } = req.body;
    if (!Array.isArray(itemIds)) {
        res.status(400).json({ error: 'Bad items' });
        return;
    }
    const account = await db.accounts.find(accountId);
    const response = await fetch(paymentUrl, { method: 'POST', body: JSON.stringify({ account, itemIds }) });
    res.json(await response.json());
});
```

```ts
// Good: middleware validates and authenticates; the route makes one domain call.
router.post('/orders', authenticate, validateBody(submitOrderSchema), async (req, res) => {
    const order = await submitOrder(res.locals.accountId, res.locals.body);
    res.status(201).json(order);
});
```

- Read request data only through the validated value. A cast such as `req.body as Order`
  validates nothing.
- Middleware can enforce ownership. It reaches the database for product behavior only through auth
  or ownership helpers built for that boundary.
- A permission check that depends on domain state belongs in a module; a transport-level one
  belongs in ownership middleware.
- A domain function takes domain inputs and returns the module's result contract. It never takes
  the raw request, response, provider, or database object.

```ts
// Bad.
export async function submitOrder(req: AuthenticatedRequest) {}

// Good.
export async function submitOrder(request: SubmitOrderRequest, trace: RequestTrace): Promise<SubmitOrderResult> {}
```

## Errors

- Express 5 forwards the rejection of a promise that a route or middleware returns, so return the
  promise and add no wrapper that repeats this. Express 4 needs the project's async handler or an
  explicit `next(error)`.
- Callback-based asynchronous work passes its errors to `next(error)` in both versions.
- Error middleware keeps its four-argument signature, even when an argument is unused.
- When the headers are already sent, error middleware calls `next(error)` instead of writing a
  second response.
- The not-found handler comes after every route.

## Body parsing and proxies

Parsing a body is work, so mount a JSON parser with a small default limit, and a larger one only on
the route that needs it. A large limit matches the reverse proxy's and the provider's limits.

```ts
// Bad: every endpoint inherits an oversized JSON parser.
app.use(express.json({ limit: '50mb' }));

// Good: a larger limit only where the endpoint needs it.
app.use('/imports', express.json({ limit: '5mb' }), importsRouter);
app.use(express.json({ limit: '100kb' }));
```

Enable `trust proxy` only when the deployment topology is known, set to the proxies whose
forwarding headers are trusted. Route-specific rate limits sit next to route assembly in the
application factory or the endpoint owner.

## References

| Topic          | Primary source                                                                   |
| -------------- | -------------------------------------------------------------------------------- |
| Error handling | [Express error handling](https://expressjs.com/en/guide/error-handling/)         |
| Security       | [Production security](https://expressjs.com/en/advanced/best-practice-security/) |
| Proxies        | [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)     |
