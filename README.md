Supoppsedely, migrations will only work properly with cascading setup when using remote d1 databases according to this issue comment:
https://github.com/cloudflare/workers-sdk/issues/5438#issuecomment-3601587321

Step by step without workaround:
- run `pnpm db:migration:apply --local` we need to keep the local database up to date with the remote database so we can create the diff scripts
- run `pnpm db:migration:apply --remote` to only apply the initial migration remote
- run `pnpm db:seed --remote` to seed the remote database
- run `pnpm db:snapshot` to log the correct results
- rename `0002_change-user.sql_` to `0002_change-user.sql` convenience so we don't have to modify prisma schema and run db:migration:create + db:migration:script steps
- run `pnpm db:migration:apply --local` local sync
- run `pnpm db:migration:apply --remote` to apply the new migration to the remote database
- run `pnpm db:snapshot` to log the results indicating the problem with d1 migrations

Step by step with workaround:
- run `pnpm db:reset --local` to reset the local database
- run `pnpm db:reset --remote` to reset the remote database
- rename `0002_change-user.sql` back to `0002_change-user.sql_` so we can isolate the first migration
- run `pnpm db:migration:apply --local` we need to keep the local database up to date with the remote database so we can create the diff scripts
- run `pnpm db:migration:apply:workaround ./prisma/migrations/0001_init.sql` alternative apply script that uses execute and manually writes to migration history to keep track of the migrations
- run `pnpm db:seed --remote` to seed the remote database
- run `pnpm db:snapshot` to log the correct results
- rename `0002_change-user.sql_` to `0002_change-user.sql`
- run `pnpm db:migration:apply --local` local sync
- run `pnpm db:migration:apply --remote` to apply the new migration to the remote database
- run `pnpm db:snapshot` to log the results indicating the problem with d1 migrations


db:reset or db:seed with --local or --remote flag

Other problems with prisma + d1:

- There is no diff method for remote d1 databases. So you have to migrate locally and remote to generate scripts to apply to the remote database.
- It is necessary to have a local database even if its not used, because the local database is used to generate the scripts to apply to the remote database.
- I had to use cloudflare vite plugin to start the dev server, because wrangler dev was causing this error:
  `X [ERROR] ENOENT: no such file or directory, open '[REDACTED]\cf-remote-d1-workaround\  wrangler\tmp\dev-GevZpY\98a3ee0cbc7381b8b5d29673ca18c9c06953c305-query_compiler_bg.wasm?module'`
