-- Run this in Supabase SQL editor after applying Drizzle migrations.
-- App writes that require elevated privileges should use SUPABASE_SERVICE_ROLE_KEY server-side only.

alter table users enable row level security;
alter table credits enable row level security;
alter table subscriptions enable row level security;
alter table jobs enable row level security;
alter table transactions enable row level security;
alter table user_language_profiles enable row level security;
alter table conversation_sessions enable row level security;
alter table conversation_analyses enable row level security;
alter table exercise_sets enable row level security;

drop policy if exists "users can read own profile" on users;
create policy "users can read own profile"
on users for select
using (auth.uid() = auth_user_id);

drop policy if exists "users can read own credits" on credits;
create policy "users can read own credits"
on credits for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own subscriptions" on subscriptions;
create policy "users can read own subscriptions"
on subscriptions for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own jobs" on jobs;
create policy "users can read own jobs"
on jobs for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own transactions" on transactions;
create policy "users can read own transactions"
on transactions for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own user_language_profiles" on user_language_profiles;
create policy "users can read own user_language_profiles"
on user_language_profiles for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own conversation_sessions" on conversation_sessions;
create policy "users can read own conversation_sessions"
on conversation_sessions for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own conversation_analyses" on conversation_analyses;
create policy "users can read own conversation_analyses"
on conversation_analyses for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

drop policy if exists "users can read own exercise_sets" on exercise_sets;
create policy "users can read own exercise_sets"
on exercise_sets for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
