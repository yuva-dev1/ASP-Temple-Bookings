# ASP Temple Bookings

Public, one-slot-per-day booking page for **Kartik Maas Nama Bhiksha 2026**. The React client calls an Express TypeScript BFF; only the BFF holds the shared token used by the bound Google Apps Script. The script validates the token, reserves dates under a lock, records bookings in `Sheet1`, and emails the guest and administrator.

## Booking flow

The public calendar, booking details form, and booking confirmation are separate routes. Selecting an open day navigates to `/booking?date=YYYY-MM-DD`; successful reservations navigate to `/confirmation`. The form captures name, email, 10-digit phone, street, city, state, ZIP, occasion/reason, and optional additional notes. Confirmation IDs and captured fields are stored with the date and scheduled time in `Sheet1`.

## Schedule

- October 25–November 24, 2026
- Most days: 4:00–4:30 pm
- Mondays: 7:15–7:45 pm
- Saturday, November 7: 10:00–10:30 am
- One active booking per date. Cancellation frees the date; guests can edit or cancel with their confirmation ID and booking email.

## Google Sheets setup

The bound project **Kartik Maas Nama Bhiksha 2026** is attached to the supplied `ASP Temple Bookings` workbook. `apps-script/Code.gs` is its source. Set Apps Script Script Property `BFF_SHARED_TOKEN` to the same 256-bit secret used by Cloud Run. `ADMIN_NOTIFICATION_EMAILS` accepts a comma- or semicolon-separated list for administrator notifications. Run `initializeBookingSheet` after deployment to add the new booking detail headers. It upgrades the prior nine-column schema while retaining any existing booking rows. The `Sheet1` header schema is initialized in row 1:

`confirmation_id, created_at, updated_at, status, name, email, phone, date, time, street, city, state, zip_code, full_address, occasion, additional_notes`

Deploy the Apps Script as a web app executing as the owner and allowing anyone to invoke it. The BFF secret check is the authorization boundary; requests without the shared token are rejected. Grant MailApp authorization on the first execution.

## Local development

```sh
npm install
npm run dev
```

Set `APPS_SCRIPT_URL` and `APPS_SCRIPT_TOKEN` in a local `.env` (ignored by Git). The client uses `/api` in development and production.

## Cloud Run

Builds run from the included Dockerfile. Configure `APPS_SCRIPT_URL` and mount a Secret Manager version as `APPS_SCRIPT_TOKEN`. Deploy in `us-central1` with public HTTP access. No main-site navigation link is added by this project.
