# Cloudflare D1 workaround for migration issues with cascading setup

Based alsuren's comment on this issue: https://github.com/cloudflare/workers-sdk/issues/5438#issuecomment-3601587321

Using remote D1 for development. For local dev check note below.

This uses Prisma but the workaround is ORM agnostic, the same applies to Drizzle.

You also need to consider the placement of the pragmas in the migration file, prisma for example places it in the middle of the file which doesn't work (check below for more details).

## What fails (no workaround)
1) `pnpm db:migration:apply --local` (we need to keep local db in sync to create future migration scripts)
2) `pnpm db:migration:apply --remote` (apply 0001. The 0002 migration is ignored because of the .sql_ extension)
3) `pnpm db:seed --remote`
4) `pnpm db:snapshot` or `pnpm db:snapshot:export` (first snapshot for comparison)
5) rename `0002_change-user.sql_` → `0002_change-user.sql` (simulate new schema change)
6) `pnpm db:migration:apply --local` (sync)
7) `pnpm db:migration:apply --remote` (apply 0002, triggers cascade issue)
8) `pnpm db:snapshot` or `pnpm db:snapshot:export` (shows failure compared to first snapshot)

## Working sequence (with workaround)
1) `pnpm db:reset --local`
2) `pnpm db:reset --remote`
3) rename `0002_change-user.sql` → `0002_change-user.sql_` (simulate that only 0001 exists)
4) `pnpm db:migration:apply --local` (local kept current; Prisma ```migration diff``` needs it)
5) `pnpm db:migration:apply:workaround ./prisma/migrations/0001_init.sql` (uses `d1 execute`, records history)
6) `pnpm db:seed --remote`
7) `pnpm db:snapshot` or `pnpm db:snapshot:export`
8) rename `0002_change-user.sql_` → `0002_change-user.sql` (simulate a schema change)
9) `pnpm db:migration:apply --local` (sync local)
10) `pnpm db:migration:apply:workaround ./prisma/migrations/0002_change-user.sql`
11) `pnpm db:snapshot` or `pnpm db:snapshot:export` (confirms success)

## Local D1 note
"If you want this to work then you will need to check that there is nothing running, then make a backup of .wrangler/state/v3/d1/ then
use `sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite --cmd '.read ./prisma/migrations/0002_change-user.sql` or
prisma's tooling to apply the migration without a transaction, and roll back if it fails -- alsuren"

## Pragma must be at the top of the file

if your migration file contains a pragma statement, it must be at the top of the file.

This is what prisma generates and causes cascading issues:

```sql
-- create table a
CREATE TABLE "table_a" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "fullName" TEXT
);
INSERT INTO "new_User" ("email", "id") SELECT "email", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- create table b
CREATE TABLE "table_b" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);
```

This works:

```sql
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- create table a
CREATE TABLE "table_a" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- RedefineTables
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "fullName" TEXT
);
INSERT INTO "new_User" ("email", "id") SELECT "email", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


-- create table b
CREATE TABLE "table_b" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
```

## Known Prisma + D1 issues
- No prisma ```migration diff``` for remote D1; generate scripts comparing to local DB.
- Dev server only works with Cloudflare Vite plugin; `wrangler dev` errors because of this issue: https://github.com/cloudflare/workers-sdk/issues/11535.
