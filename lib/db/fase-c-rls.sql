-- Run this in Supabase SQL editor after applying the Fase C Drizzle migration.
-- Users can only access analysis and exercise rows that belong to their app user id.

alter table conversation_analyses enable row level security;
alter table exercise_sets enable row level security;

create policy "Users can read own conversation analyses"
on conversation_analyses for select
using (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can insert own conversation analyses"
on conversation_analyses for insert
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can update own conversation analyses"
on conversation_analyses for update
using (
  user_id = (select id from users where auth_user_id = auth.uid())
)
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can read own exercise sets"
on exercise_sets for select
using (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can insert own exercise sets"
on exercise_sets for insert
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can update own exercise sets"
on exercise_sets for update
using (
  user_id = (select id from users where auth_user_id = auth.uid())
)
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);
