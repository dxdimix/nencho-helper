-- サクッとねんちょー：招待制にする。
-- 「写真で登録」を使えるのは、nencho_members に入っている人（自宅PCの管理画面から招待した人）だけ。
-- このプロジェクトに以前のシステムのアカウントが残っていても、招待していなければ使えない。
-- 招待（行の追加・削除）は、自宅PCのアプリが secret キーで行う（画面からは変更できない）。

create table if not exists public.nencho_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  invited_at timestamptz not null default now()
);

alter table public.nencho_members enable row level security;

drop policy if exists "read own membership" on public.nencho_members;
create policy "read own membership" on public.nencho_members
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 写真を送れるのは、招待された人だけ
drop policy if exists "insert own pending jobs" on public.read_jobs;
create policy "insert own pending jobs" on public.read_jobs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending' and result is null and error is null
    and exists (select 1 from public.nencho_members m where m.user_id = (select auth.uid()))
  );
