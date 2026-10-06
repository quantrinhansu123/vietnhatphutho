-- Viber notify 1-chieu (OTP / don hang): lich su gui + trang thai webhook Vonage.
-- Chay 1 lan tren Supabase (DB chinh he-thong). Ten bang doi duoc qua SUPABASE_VIBER_MESSAGES_TABLE.
create table if not exists public.viber_messages (
  id bigint generated always as identity primary key,
  to_number text not null,                 -- SDT da chuan hoa 84xxx (Vonage yeu cau, khong dau +)
  text text not null,                      -- noi dung OTP / don hang (<= 1000 ky tu, validate o API)
  message_uuid text not null unique,       -- Vonage tra ve (202 Accepted); mode log: "log-..."
  provider text not null default 'log',     -- log | vonage_sandbox | vonage_prod
  status text not null default 'submitted',-- submitted -> delivered / failed / rejected ... (qua webhook)
  last_webhook jsonb,                      -- payload webhook gan nhat tu Vonage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists viber_messages_to_number_idx on public.viber_messages (to_number);
create index if not exists viber_messages_status_idx on public.viber_messages (status);
