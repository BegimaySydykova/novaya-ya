-- PROFILES
create policy "authenticated can read profiles"
on public.profiles
for select
to authenticated
using (true);


-- DAYS
create policy "authenticated can read days"
on public.days
for select
to authenticated
using (true);


-- GOALS
create policy "authenticated can read goals"
on public.goals
for select
to authenticated
using (true);


-- WEIGHTS
create policy "authenticated can read weights"
on public.weights
for select
to authenticated
using (true);


-- MEASUREMENTS
create policy "authenticated can read measurements"
on public.measurements
for select
to authenticated
using (true);


-- NOTES
create policy "authenticated can read notes"
on public.notes
for select
to authenticated
using (true);


-- REWARDS
create policy "authenticated can read rewards"
on public.rewards
for select
to authenticated
using (true);
