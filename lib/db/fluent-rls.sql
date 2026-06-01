-- Run this in Supabase SQL editor after applying Fluent Drizzle migrations.
-- App writes that require elevated privileges should use SUPABASE_SERVICE_ROLE_KEY server-side only.

alter table user_language_profiles enable row level security;
alter table conversation_sessions enable row level security;

create policy "Users can read own language profile"
on user_language_profiles for select
using (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can insert own language profile"
on user_language_profiles for insert
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can update own language profile"
on user_language_profiles for update
using (
  user_id = (select id from users where auth_user_id = auth.uid())
)
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can read own sessions"
on conversation_sessions for select
using (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can insert own sessions"
on conversation_sessions for insert
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);

create policy "Users can update own sessions"
on conversation_sessions for update
using (
  user_id = (select id from users where auth_user_id = auth.uid())
)
with check (
  user_id = (select id from users where auth_user_id = auth.uid())
);
