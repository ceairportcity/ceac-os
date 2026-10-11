undefined

### Local replay fidelity corrections

The passing 52-gate run depends on reproducing the managed database execution context accurately:

- Run repository migrations and SQL gates as role `postgres` (for example with a connection option that sets `role=postgres` after the local bootstrap superuser connects). Running them as the bootstrap account changes object ownership and default privileges, causing false ACL failures or false passes.
- Seed `supabase_migrations.schema_migrations` with each successfully applied filename version; migration-history gates must test the same state the Supabase CLI maintains.
- Configure PostgreSQL `timezone=Africa/Accra`; attendance gates use the approved Ghana operational timezone and can fail incorrectly if the disposable cluster inherits another timezone.
- The runner-only Auth compatibility table must include the fields exercised by rollback-only MFA tests, including TOTP secret and phone factor shapes. Values are synthetic and rolled back.
- The runner-only Vault compatibility extension must grant its managed service surface to `service_role` while keeping ordinary browser roles out. This models the local test boundary only and is not a CEAC production grant.


### Work local browser server networking

Work shell executions can share files and process listings while still isolating loopback networking between execution sessions. A Vite process started in one long-running shell may therefore appear alive from another shell while `127.0.0.1:5173` is unreachable there.

For reproducible local Playwright browser runs:

1. start Vite/preview in the background and capture its PID;
2. poll its HTTP URL;
3. execute Playwright;
4. stop the server with a shell trap;

all inside the same bounded shell execution. A terminal-like persistent process in a different Work execution is not proof that browser workers can reach it. Treat `ERR_CONNECTION_REFUSED` from the cross-session pattern as an invalid harness run, not an application failure.
