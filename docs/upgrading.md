# Upgrading from the legacy schema

The template v1 cutover squashes the schema into `0001_init` and replaces the
dynamic role table with the hardcoded roles `admin`, `manager`, `staff` and
`viewer`. Existing deployments must export accounts and import them into a new
database. Passwords keep their bcrypt hash, so users do not need a new password
before the forced-change step below.

## 1. Back up the old database

```bash
mariadb-dump \
  --single-transaction --routines --triggers --hex-blob \
  --host=<old-host> --user=<old-user> --password \
  <old-database> > legacy-backup.sql
```

Restore test: `mariadb <old-database> < legacy-backup.sql` on a scratch server.
Keep the dump until the rollout has been verified.

## 2. Create the new database

```sql
CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_runtime'@'%' IDENTIFIED BY '<runtime-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO 'app_runtime'@'%';
CREATE USER 'app_migrator'@'%' IDENTIFIED BY '<migrator-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON `app`.* TO 'app_migrator'@'%';
```

Run the baseline migration:

```bash
MIGRATE_DATABASE_URL='mysql://app_migrator:<password>@<host>:3306/app' \
  npm --prefix server run db:deploy
```

## 3. Export the legacy accounts

`LEGACY_DATABASE_URL` is only read by the export script. It opens a read-only
transaction and never prints password hashes.

```bash
LEGACY_DATABASE_URL='mysql://readonly:<password>@<old-host>:3306/<old-db>' \
  npm run legacy:export -- --dry-run

LEGACY_DATABASE_URL='mysql://readonly:<password>@<old-host>:3306/<old-db>' \
  npm run legacy:export -- --out legacy-accounts.ndjson
```

The dry run prints the role mapping counts and writes nothing. Mapping rules:

| Legacy role                         | Template role |
| ----------------------------------- | ------------- |
| `level = -1` or name contains admin | `admin`       |
| name contains manager or gerente    | `manager`     |
| name contains staff or operador     | `staff`       |
| anything else / missing role        | `viewer`      |

`status = active` stays active; every other status (including the legacy
`locked`) becomes `inactive`. Each NDJSON line contains `id`, `email`, `name`,
`password`, `role`, `status` and `createdAt`.

## 4. Import into the new database

Preview, then import:

```bash
DATABASE_URL='mysql://app_migrator:<password>@<host>:3306/app' \
  npm run legacy:import -- --file legacy-accounts.ndjson --dry-run

DATABASE_URL='mysql://app_migrator:<password>@<host>:3306/app' \
  npm run legacy:import -- --file legacy-accounts.ndjson
```

The import preserves ids and bcrypt hashes, creates one metadata row per
account, skips accounts that already exist by id or email, and sets
`mustChangePassword = true`. It is safe to rerun after fixing a bad row.

Verify counts before cutover:

```sql
SELECT role, status, COUNT(*) FROM Account GROUP BY role, status;
SELECT COUNT(*) FROM Account;
```

Compare the total with the old database and spot-check a few emails and roles.

## 5. Cut over

1. Put the old application in maintenance mode and stop writes.
2. Take a final export and import, or repeat steps 1-4 for the delta.
3. Configure the new API (`DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGINS`,
   optionally `ORIGIN_SECRET`) and start it.
4. Do not run `db:seed` against an imported database; it is a no-op once any
   account exists. Use it only when creating a brand-new empty deployment.
5. Point clients at the new API, sign in, and confirm the role matrix and the
   forced password change.

Sessions are **not migrated**. The session table belongs to the old database and
every user must sign in again. Changing `SESSION_SECRET` also invalidates
sessions and is expected during cutover.

## 6. Roll back

Keep the old image and the dump until the new deployment has been accepted.

1. Stop the new API.
2. Recreate or restore the old database with `mariadb <old-database> < legacy-backup.sql`.
3. Deploy the previous image and configuration.
4. Point clients back at the old API and clear the browser cookies for the
   domain.

Because the new schema lives in a separate database, rollback does not require
dropping the new tables; detach or archive that database after verification.
