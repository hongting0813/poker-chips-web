-- Create Rooms Table
create table public.rooms (
  id text primary key,
  status text not null default 'waiting', -- waiting, playing, finished
  pot integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Players Table
create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id text references public.rooms(id) on delete cascade not null,
  user_id text not null, -- LocalStorage ID or Auth ID
  name text not null,
  avatar text not null default '👤',
  seat_index integer not null default -1,
  balance integer not null default 0,
  current_bet integer not null default 0,
  is_host boolean not null default false,
  is_folded boolean not null default false,
  last_seen timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure unique seat per room (optional, but good for integrity)
  -- unique(room_id, seat_index) -- Commented out to prevent initial race conditions, handled by app logic for now
  unique(room_id, user_id) -- One player per room
);

-- Enable RLS (Row Level Security) - Open for public demo
alter table public.rooms enable row level security;
alter table public.players enable row level security;

-- Policies (Allow all for now for ease of use)
create policy "Allow public read access" on public.rooms for select using (true);
create policy "Allow public insert access" on public.rooms for insert with check (true);
create policy "Allow public update access" on public.rooms for update using (true);

create policy "Allow public read access" on public.players for select using (true);
create policy "Allow public insert access" on public.players for insert with check (true);
create policy "Allow public update access" on public.players for update using (true);
create policy "Allow public delete access" on public.players for delete using (true);

-- Enable Realtime
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
