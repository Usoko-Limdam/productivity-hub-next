# Multi-business workspace rollout

The application code in this change expects `001_multi_business_workspaces.sql` to have been applied. Do not deploy the code first: the server reads the workspace tables and `items.workspace_id` as soon as an authenticated request opens the app.

## Safe rollout sequence

1. Take and verify a restorable backup of the production database.
2. Review the migration and confirm the target database is the WorkHub production database.
3. Apply `001_multi_business_workspaces.sql` once, using the database provider's SQL console or migration runner.
4. Check the migration's final queries: all existing records should be under `ascendvista`, and `unassigned_items` should be zero. The migration preserves each existing record's ID, JSON data, and creation timestamp; it does not delete or rewrite those records.
5. Deploy the application code only after the schema and seeded workspace rows are present.
6. Sign in and confirm AscendVista opens with its existing records, then switch to Bravestone Learning and verify its modules start empty.

The SQL file has not been run by the application build and is not run automatically by `lib/db.js`. The migration seeds the existing owner principal into both workspaces; team accounts and per-user memberships are not implemented by this solo-owner release.

## Rollback note

Do not drop the workspace tables or remove `workspace_id` as a quick rollback after new records have been created. First export or back up both workspaces and decide how Bravestone records should be retained. Reverting only the application code would not delete workspace data, but the legacy app could expose records without workspace filtering, so code rollback after workspace use also needs a reviewed data-safe plan.
