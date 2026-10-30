# Example module: Items

`Items` is a complete vertical slice that demonstrates the conventions of this
template: explicit shared contracts, a transactional service with business
audit, default-deny REST routes, role-gated client UI, and tests. Copy it when
you add a new module, or remove it with `scripts/remove-example.mjs` when you no
longer need a reference implementation.

## Files that make up the example

### Shared contracts

| File                             | Purpose                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `shared/src/schemas/items.ts`    | `createItemSchema`, `updateItemSchema`, `listItemsQuerySchema`, `ItemStatus`.           |
| `shared/src/api/items.ts`        | `ItemDto`, response types, request type re-exports.                                     |
| `shared/src/schemas/index.ts`    | Re-exports the items schemas.                                                           |
| `shared/src/api/index.ts`        | Re-exports the items API contracts.                                                     |
| `shared/src/index.ts`            | Exports `ItemDto` and the `itemApi` namespace.                                          |
| `shared/src/rbac/permissions.ts` | Declares `items:read`, `items:create`, `items:update`, `items:delete`, `items:restore`. |
| `shared/src/rbac/matrix.ts`      | Grants `items:*` to admin/manager, read/create/update to staff, read to viewer.         |
| `shared/src/rbac/rbac.test.ts`   | Asserts the expected item grants.                                                       |

### Server

| File                                     | Purpose                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `server/src/services/item-service.ts`    | List, get, create, update, soft delete, restore; one transaction per mutation and audit rows through `db/audit.ts`. |
| `server/src/controllers/items.ts`        | HTTP handlers that pass the validated body/query and authenticated actor to the service.                            |
| `server/src/routes/items.ts`             | REST routes with authentication and `items:*` permissions.                                                          |
| `server/src/http/dto/items.ts`           | Maps Prisma rows to `ItemDto`.                                                                                      |
| `server/src/routes/index.ts`             | Mounts `/api/items`.                                                                                                |
| `server/src/app.ts`                      | Builds the item service and injects it into the router.                                                             |
| `server/test/items.test.ts`              | Integration tests for the permission matrix, audit rows, soft delete/restore, and pagination limits.                |
| `server/test/routes/route-audit.test.ts` | Includes the item routes in the default-deny audit.                                                                 |
| `server/test/helpers/db.ts`              | Truncates the `Item` table between tests.                                                                           |

### Client

| File                                                     | Purpose                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `client/src/features/items/api.ts`                       | Item requests through the shared axios instance (CSRF enabled).                       |
| `client/src/features/items/hooks/useItems.ts`            | Server-side pagination, search, status filter, loading/error state, invalidate/retry. |
| `client/src/features/items/hooks/useItemMutations.ts`    | Create/update/delete/restore mutations that invalidate the list.                      |
| `client/src/features/items/components/ItemsTable.tsx`    | AntD table, filters, pagination, row actions, empty/loading/error states.             |
| `client/src/features/items/components/ItemFormModal.tsx` | Create/edit form validated with the shared Zod schemas.                               |
| `client/src/features/items/components/ItemsPage.tsx`     | Wires hooks, modal, confirmations, and localised messages together.                   |
| `client/src/features/items/ItemsPage.test.tsx`           | RTL tests for rows, role-gated buttons, and the error state.                          |
| `client/src/features/items/index.ts`                     | Public exports for the feature.                                                       |
| `client/src/routes/admin/items.tsx`                      | `/admin/items` route guarded by `items:read`.                                         |
| `client/src/layouts/Admin.tsx`                           | Navigation entry gated by `<Can permission="items:read">`.                            |
| `client/src/locales/{en,es}/*`                            | Page, permission, nav and item error strings in both locales.                        |
| `client/src/routeTree.gen.ts`                            | Generated TanStack route tree entry.                                                  |

### Database

| Location                                           | Purpose                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `server/prisma/schema.prisma`                      | `Item` model, `ItemStatus { active archived }`, and the `Metadata.item` relation. |
| `server/prisma/migrations/0001_init/migration.sql` | Creates the Item table and enum. Do not edit this applied migration.              |
| A later `*_drop_item` migration                    | Created by the removal script; drops the example table and enum.                  |

## Add a new module by copying Items

The example below renames `Item` to `Widget`.

1. Pick names and permissions:
   - model `Widget`, enum `WidgetStatus`, table created by the baseline migration
     (Prisma uses the model name).
   - permissions `widgets:read`, `widgets:create`, `widgets:update`,
     `widgets:delete`, `widgets:restore`.
   - route `/api/widgets` and client route `/admin/widgets`.
2. Copy the shared files:
   ```bash
   cp shared/src/schemas/items.ts shared/src/schemas/widgets.ts
   cp shared/src/api/items.ts shared/src/api/widgets.ts
   ```
   Rename `Item`→`Widget`, `ItemStatus`→`WidgetStatus`, `itemApi`→`widgetApi`,
   `items`→`widgets`, and the `q`/status fields as needed. Re-export both files
   from `shared/src/schemas/index.ts`, `shared/src/api/index.ts`, and
   `shared/src/index.ts`.
3. Add permissions to `shared/src/rbac/permissions.ts` and grant them in
   `shared/src/rbac/matrix.ts`. Admin receives every permission through
   `PERMISSIONS`, so it needs no explicit entry. Update
   `shared/src/rbac/rbac.test.ts`.
4. Copy the server slice:
   ```bash
   cp server/src/services/item-service.ts server/src/services/widget-service.ts
   cp server/src/controllers/items.ts server/src/controllers/widgets.ts
   cp server/src/routes/items.ts server/src/routes/widgets.ts
   cp server/src/http/dto/items.ts server/src/http/dto/widgets.ts
   cp server/test/items.test.ts server/test/widgets.test.ts
   ```
   Rename identifiers and permission strings. Mount the router in
   `server/src/routes/index.ts`, add the service to `registerRoutes` in
   `server/src/routes/index.ts`, construct it in `server/src/app.ts`, and add
   the router to `server/test/routes/route-audit.test.ts`.
5. Add the Prisma model and enum to `server/prisma/schema.prisma`, including a
   `metadataId`/`metadata` relation mirroring `Item`, then create a forward
   migration:
   ```bash
   cd server
   MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate dev --create-only --name add_widget
   # inspect and edit the generated SQL, then:
   MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate deploy
   ```
   Never edit a migration that has already been applied and never use
   `prisma db push`.
6. Copy the client feature and route:
   ```bash
   cp -R client/src/features/items client/src/features/widgets
   cp client/src/routes/admin/items.tsx client/src/routes/admin/widgets.tsx
   ```
   Rename imports, keys, API paths, route ids, and `<Can permission="widgets:*">`
   gates. Add the nav entry and the `pages.admin.widgets`/`layouts.sidebar.widgets`
   locale keys. Building the client regenerates `client/src/routeTree.gen.ts`.
7. Run the checks from the repository root:
   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

## Remove the example

Always preview first:

```bash
node scripts/remove-example.mjs --dry-run
```

The dry run lists every file and edit and writes nothing. Then run:

```bash
node scripts/remove-example.mjs
```

The script is idempotent. It deletes the example files and removes the shared
exports, `items:*` permissions, role grants, server routes/dependencies, client
nav/route/locale entries, generated route-tree entries, and the Prisma `Item`
model, `ItemStatus` enum, and `Metadata.item` relation. It then asks Prisma to
create a `drop_item` migration with `prisma migrate dev --create-only`. That
command needs a development database (and permission to create a shadow
database). If no database is configured, the script prints the exact command to
run later.

Review the generated migration, apply it with `prisma migrate deploy`, and run
the full check suite again:

```bash
npm --prefix shared run build
npm run lint && npm run typecheck && npm run test && npm run build
```

Keep this document; it is not deleted by the script.
