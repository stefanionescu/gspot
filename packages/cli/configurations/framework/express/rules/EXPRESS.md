# Express

Read this rule when you change routes, middleware, or error handling in an Express service.

Follow the HTTP rules too.

## Routes and middleware

<!-- level: all -->

Express requires no layout, schema library, or response envelope. Use the contracts the project
already has instead of adding competing ones.

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

- Middleware can enforce ownership. It reaches the database for product behavior only through auth
  or ownership helpers built for that boundary.
- A permission check that depends on domain state belongs in a module, and a transport-level one
  in ownership middleware.

## Errors

- Express 5 forwards a rejected promise that a route or middleware returns, so return it and add
  no wrapper that repeats this. Express 4 needs the project's async handler or an
  explicit `next(error)`.
- Callback-based asynchronous work passes its errors to `next(error)` in both versions.
- Error middleware keeps its four-argument signature, even when the function does not use an argument.
- After the headers go out, error middleware calls `next(error)` instead of writing a second
  response.
- The not-found handler comes after every route.

## Body parsing and proxies

Parsing a body takes work, so mount a JSON parser with a small default limit, and a larger one only on
the route that needs it.

```ts
// Bad: every endpoint inherits an oversized JSON parser.
app.use(express.json({ limit: '50mb' }));

// Good: a larger limit only where the endpoint needs it.
app.use('/imports', express.json({ limit: '5mb' }), importsRouter);
app.use(express.json({ limit: '100kb' }));
```

Enable `trust proxy` only when you know the deployment topology. Select the proxies whose
forwarding headers you trust.

## References

| Topic          | Primary source                                                                   |
| -------------- | -------------------------------------------------------------------------------- |
| Error handling | [Express error handling](https://expressjs.com/en/guide/error-handling/)         |
| Security       | [Production security](https://expressjs.com/en/advanced/best-practice-security/) |
| Proxies        | [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)     |
