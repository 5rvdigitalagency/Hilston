# Deployment order

1. Set the target database connection and deployment environment variables without printing their values.
2. Run `npm run db:migrate` against the target database.
3. Confirm the migration command succeeds and records the versions in `schema_migrations`.
4. Deploy this build with `npm run build` already passing.

For a database that already contains the columns created by the old runtime DDL, run `npm run db:migrate -- --baseline` once instead of replaying the migrations. The migration SQL is idempotent, so a normal migration run is also safe when the columns already exist.

Never run `npm run db:migrate -- --down` in production unless the rollback is intentional and `EVENT_DEPLOYMENT_ROLE=production CONFIRM=prod` are both set. Rollbacks remove columns and can delete data.