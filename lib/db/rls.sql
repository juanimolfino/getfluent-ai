-- Run this in Supabase SQL editor after applying Drizzle migrations.
-- App writes that require elevated privileges should use SUPABASE_SERVICE_ROLE_KEY server-side only.

alter table users enable row level security;
alter table credits enable row level security;
alter table subscriptions enable row level security;
alter table jobs enable row level security;
alter table transactions enable row level security;

create policy "users can read own profile"
on users for select
using (auth.uid() = auth_user_id);

create policy "users can read own credits"
on credits for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

create policy "users can read own subscriptions"
on subscriptions for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

create policy "users can read own jobs"
on jobs for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);

create policy "users can read own transactions"
on transactions for select
using (
  user_id in (select id from users where auth_user_id = auth.uid())
);
