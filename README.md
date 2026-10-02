# ASP Temple Bookings

Public, one-slot-per-day booking page for **Kartik Maas Nama Bhiksha 2026**. The React client calls an Express TypeScript BFF; only the BFF holds the shared token used by the bound Google Apps Script. The script validates the token, reserves dates under a lock, records bookings in `Sheet1`, and emails the guest and administrator.

## Schedule

- October 25–November 24, 2026
- Most days: 4:00–4:30 pm
- Mondays: 7:15–7:45 pm
- Saturday, November 7: 10:00–10:30 am
- One active booking per date. Cancellation frees the date; guests can edit or cancel with their confirmation ID and booking email.

## Google Sheets setup

The bound project **Kartik Maas Nama Bhiksha 2026** is attached to the supplied `ASP Temple Bookings` workbook. `apps-script/Code.gs` is its source. Set Apps Script Script Property `BFF_SHARED_TOKEN` to the same 256-bit secret used by Cloud Run. Optional `ADMIN_NOTIFICATION_EMAIL` overrides the script owner's email for administrator notifications. The `Sheet1` header schema is initialized in row 1:

`confirmation_id, created_at, updated_at, status, name, email, phone, date, time`

Deploy the Apps Script as a web app executing as the owner and allowing anyone to invoke it. The BFF secret check is the authorization boundary; requests without the shared token are rejected. Grant MailApp authorization on the first execution.

## Local development

```sh
npm install
npm run dev
```

Set `APPS_SCRIPT_URL` and `APPS_SCRIPT_TOKEN` in a local `.env` (ignored by Git). The client uses `/api` in development and production.

## Cloud Run

Builds run from the included Dockerfile. Configure `APPS_SCRIPT_URL` and mount a Secret Manager version as `APPS_SCRIPT_TOKEN`. Deploy in `us-central1` with public HTTP access. No main-site navigation link is added by this project.
