# CEAC standby deployment runbook

Date: 7 October 2026
Primary remains: Vercel
Cutover authorised: **No**

## Prepare without Git deployment automation

```sh
npm ci
npm run build
npm run standby:prepare
```

`standby-output/` contains the already-built site, checksums, source SHA, a small Node static server and an unprivileged Nginx container definition. It can be transferred to a supported static host or container platform without GitHub-to-provider integration.

Local verification:

```sh
node standby-output/serve-prebuilt.mjs standby-output/site 4173
```

Container verification (copy the prepared site into the container context first):

```sh
cp -R standby-output/site standby-output/container/site
docker build -t ceac-standby:<sha> standby-output/container
docker run --rm -p 8080:8080 ceac-standby:<sha>
```

## Provider requirements

- HTTPS;
- SPA fallback to `/index.html`;
- `/sw.js` served with `no-cache, no-store, must-revalidate` and root scope;
- immutable caching only for hashed assets;
- CEAC security headers;
- runtime environment values supplied from approved secret/config storage;
- no service-role key in the browser or artifact.

## Safe activation sequence

1. Verify checksums and source SHA.
2. Deploy to an isolated, non-production URL.
3. Run sign-in, role, RLS, mobile, installability and update tests.
4. Confirm Supabase allowed redirect/origin settings without widening them indiscriminately.
5. Obtain product-owner approval.
6. Change routing/DNS only through a documented cutover with rollback.

This programme does not create a second production environment, alter CEAC DNS or replace Vercel.
