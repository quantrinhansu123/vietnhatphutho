# viber_messages

| | |
|---|---|
| **Bang** | `viber_messages` |
| **Route** | `POST /api/notify`, `GET /api/messages`, `POST /webhooks/vonage/status` (khong dung UI) |
| **SQL** | `supabase-viber-messages.sql` |

## API (`server.ts`)

| Method | Path | Dong |
|--------|------|------|
| POST | `/api/notify` | xem `src/features/viber-notify/registerRoutes.ts` (dang ky trong `createApp`) |
| GET | `/api/messages?limit=50` | cung file tren |
| POST | `/webhooks/vonage/status` | cung file tren, luon tra 200 |

Gui 1-chieu (OTP/don hang) qua Vonage Messages API, kenh Viber Business Messages.
Khong dung Bot API (`chatapi.viber.com`), khong chat 2-chieu.

## Logic (`src/features/viber-notify/`)

- `phone.ts`: chuan hoa `0xxx` -> `84xxx` (nhan `+84`/`0084`/space-`.`-`-`), validate text 1-1000 ky tu.
- `sender.ts`: doi provider bang `.env` `VIBER_PROVIDER=log|vonage_sandbox|vonage_prod|infobip` (khong sua code).
  Sandbox: `messages-sandbox.nexmo.com` + `from=16273` (whitelist + 100 tin/thang).
  Prod: `api.nexmo.com` + `VONAGE_VIBER_SENDER_ID` (Business ID that).
  Infobip: `{INFOBIP_BASE_URL}/viber/2/messages` + `INFOBIP_API_KEY` (header `App`), sender `IBSelfServe` (trial 100 tin toi so verify).
- DB: luu `message_uuid` + `status=submitted`; webhook Vonage cap nhat `delivered/failed/...`.
  Chua chay migration -> tin van gui, API tra `stored:false` + `warning`.
- `orderNotify.ts`: auto bao don moi ve SDT noi bo `VIBER_ORDER_NOTIFY_TO` (trong = tat).
  Hook fire-and-forget sau `POST /api/don-hang` trong `server.ts`, khong chan tao don khi gui loi.
