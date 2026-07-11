# Relationship Management System (RMS)

Premium SaaS-style CRM for managing contacts, celebrations, campaigns, and outreach.

## Tech Stack

- **Frontend:** HTML5, CSS3, Bootstrap 5, Vanilla JavaScript, Bootstrap Icons, Chart.js, DataTables
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (with local JSON fallback)
- **Auth:** JWT Authentication
- **Storage:** Local uploads (`public/uploads/`) — Cloudinary-ready architecture

## Quick Start

```bash
# Install dependencies
npm install

# Generate sample data (200 contacts, festivals, events, etc.)
npm run seed

# Start the server
npm start
```

Open **http://localhost:3000**

### Demo Login

| Email | Password |
|-------|----------|
| admin@rms.com | admin123 |

## MongoDB Atlas (Optional)

Copy `.env.example` to `.env` and set your connection string:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/rms
JWT_SECRET=your-secret-key
```

Without MongoDB, the app runs in **local JSON mode** using `data/sample-data.json`.

## Project Structure

```
RMS/
├── server.js                 # Express entry point
├── server/
│   ├── config/               # Database config
│   ├── controllers/          # MVC controllers
│   ├── middleware/           # Auth, file upload
│   ├── models/               # Mongoose schemas
│   ├── routes/               # API routes
│   ├── seed/                 # Sample data generator
│   └── utils/                # JSON store fallback
├── public/
│   ├── index.html            # Login page
│   ├── pages/                # All module pages
│   ├── assets/css/           # Premium theme
│   ├── assets/js/            # Components, API, pages
│   └── uploads/              # Local file storage
└── data/
    └── sample-data.json      # Generated sample database
```

## Modules

1. **Login** — JWT auth, forgot password, remember me
2. **Dashboard** — Stats, charts, quick actions, notifications
3. **Contacts** — Full CRUD, filters, DataTables, profile view
4. **Groups** — Dynamic smart groups with rules
5. **Birthdays** — Calendar, templates, send/schedule wishes
6. **Anniversaries** — Same as birthdays
7. **Festivals** — Master, recipients, schedule, send
8. **Invitations** — Events, preview, delivery tracking
9. **Campaigns** — Multi-channel campaigns, drafts, reports
10. **Templates** — Reusable variables (`{{Name}}`, `{{City}}`, etc.)
11. **Reports** — City/sector/religion charts, delivery reports
12. **Settings** — Company, SMTP, WhatsApp API, roles, users
13. **Profile** — User profile, password, notification prefs

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/dashboard/stats | Dashboard data |
| GET/POST/PUT/DELETE | /api/contacts | Contact CRUD |
| GET/POST/PUT/DELETE | /api/groups | Group CRUD |
| GET/POST/PUT/DELETE | /api/festivals | Festival CRUD |
| GET/POST/PUT/DELETE | /api/events | Event/Invitation CRUD |
| GET/POST/PUT/DELETE | /api/campaigns | Campaign CRUD |
| GET/POST/PUT/DELETE | /api/templates | Template CRUD |
| GET | /api/reports/* | Analytics reports |
| GET/PUT | /api/settings | App settings |
| POST | /api/delivery/jobs | Queue bulk email/WhatsApp delivery |
| GET | /api/delivery/jobs | List delivery jobs |
| GET | /api/delivery/jobs/:id | Job status & progress |
| GET | /api/delivery/jobs/:id/messages | Per-message delivery log |
| POST | /api/delivery/jobs/:id/retry-failed | Requeue failed messages |
| POST | /api/delivery/test-email | Test SMTP configuration |
| GET | /api/delivery/logs | Recent delivery engine logs |

## Delivery Engine (Production)

- Background worker processes messages in batches
- Email via SMTP (nodemailer) with connection pooling
- WhatsApp via Meta Graph API (when configured)
- Invalid email/phone validation before send
- Automatic retry with exponential backoff (default 3 retries)
- Per-message status: pending → processing → delivered / failed / skipped
- Delivery job tracking UI at `/pages/delivery.html`
- File logs at `logs/rms-delivery.log`

Set `DELIVERY_DRY_RUN=true` in `.env` to test without sending real emails.
Configure SMTP in **Settings** for production email delivery.

## License

MIT
