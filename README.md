# Church Connect — Phase 1

Usher registration for newcomers and existing members. Records go straight into a private Google Sheet, ready for automated follow-up in Phase 2.

**Stack:** plain HTML + custom CSS + JavaScript, [Motion](https://motion.dev) (the vanilla-JS build of Framer Motion) for animation, Google Apps Script as the API, Google Sheets as the database. No build step, no framework, no backend server.

```
church-connect/
├── index.html
├── favicon.svg
├── css/styles.css
├── js/
│   ├── config.js        ← church name, dropdowns, Apps Script URL (EDIT THIS)
│   ├── validation.js    ← form rules + Nigerian phone normalising
│   ├── api.js           ← talks to Google Apps Script
│   ├── motion.js        ← animation helpers (safe if the CDN is blocked)
│   └── app.js           ← page logic
├── google-apps-script/Code.gs   ← the backend
├── tests/
└── netlify.toml
```

---

## 1. Run it locally

You need nothing installed to look at it: open `index.html` in a browser.
For a proper local server (recommended):

```bash
npm start        # or:  python3 -m http.server 5173
```

Open the address it prints. With no Apps Script URL set, the form shows a **"Google Sheets isn't connected yet"** banner and the save button is disabled. To try the form safely, open it with **`?demo=1`** (e.g. `http://localhost:5173/?demo=1`). Demo mode is clearly labelled and **never saves anything**.

## 2. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a blank spreadsheet. Name it e.g. **Church Connect Registrations**.
2. Copy the **Sheet ID** from the address bar: `docs.google.com/spreadsheets/d/`**`THIS_LONG_ID`**`/edit`.
3. Keep the sheet **private**. Share it only with the church staff who should see these records.

The script builds a `Registrations` tab with these 20 columns:

| # | Column | # | Column |
|---|--------|---|--------|
| 1 | Registration ID | 11 | Service Attended |
| 2 | Timestamp (server time) | 12 | Branch |
| 3 | Full Name | 13 | Referral Source |
| 4 | Phone Number (saved as +234…) | 14 | Preferred Follow-Up Method |
| 5 | Email Address | 15 | Contact Consent |
| 6 | Contact Type | 16 | Department / Ministry |
| 7 | First-Time Visitor | 17 | Additional Notes |
| 8 | Gender | 18 | Follow-Up Status |
| 9 | Age Group | 19 | Follow-Up Date |
| 10 | Service Date | 20 | Follow-Up Notes |

**Follow-Up Status values:** `Pending`, `Contacted`, `Connected`, `Completed`, `No Consent`, `Not Required`.

- Newcomer who agreed to be contacted → **Pending**
- Newcomer who said no, or wasn't asked → **No Consent** (Contact Consent shows `No` or `Not answered`)
- Existing member → **Not Required** (members are never treated as newcomers)

Columns 18–20 are for the follow-up team to fill in by hand for now.

## 3. Add and deploy the Apps Script

1. In the sheet: **Extensions → Apps Script**.
2. Delete the sample code and paste in the whole of `google-apps-script/Code.gs`.
3. At the top, set `SPREADSHEET_ID: 'your-sheet-id'`. (If you opened Apps Script from inside the sheet you can leave it blank.)
4. Set the time zone: **Project Settings (gear icon) → Time zone → (GMT+01:00) Lagos**.
5. Select **`setupSheet`** in the function dropdown and click **Run**. Approve the permissions (Google may show "unverified app": **Advanced → Go to project**; it's your own script). This creates the headers and formatting.
6. *(Optional)* Run **`testRegistration`**. A test row appears in the sheet. Delete it afterwards.
7. **Deploy → New deployment → ⚙ Select type → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).

> Whenever you change `Code.gs` later, use **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The URL stays the same.

## 4. Connect the frontend

Open `js/config.js` and paste the URL:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
CHURCH_NAME: 'Grace Chapel',          // your church name
```

Also edit `BRANCHES`, `SERVICES`, `DEPARTMENTS`, etc. there. Set `BRANCHES: []` to hide the Branch field.

Reload the page. The pill in the header should turn green: **Google Sheets connected**. (That check is a harmless ping that returns no personal data.)

## 5. Test a successful registration

1. Register a newcomer: name, `08012345678`, today's date, consent **Yes**. Tap **Register Connection**.
2. You should see **Connection saved** and a new row in the sheet with phone `+2348012345678` and status `Pending`.
3. Tap **Register Another Person**; service date, service and branch are kept to save time.
4. Register an existing member and confirm status `Not Required`.

**Things worth testing before Sunday**

| Try this | Expected |
|---|---|
| `08012345678`, `+2348012345678`, `2348012345678`, `0801 234 5678` | All saved as `+2348012345678` |
| `0801234567` (too short) or `abc` | Error beside the phone field |
| Empty name / phone / date | Errors beside each field, form data kept |
| Email `bob@` | Email error |
| Wi-Fi off, then Register | Friendly "couldn't reach Google Sheets", data kept, retry works |
| Tap the button twice quickly | One row only |

Automated checks: `npm test` (validation + backend logic with mocked Google services) and `npm run test:ui` (page behaviour in a simulated browser).

## 6. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Red pill "Can't reach Google Sheets" | Wrong URL, or the deployment isn't set to **Anyone**. Open the URL in a browser tab: you should see `{"ok":true,"service":"church-connect"...}`. If you get a Google sign-in page, change access to **Anyone** and redeploy. |
| "Google sent back something unexpected" | Same cause as above, or the URL doesn't end in `/exec`. |
| "Couldn't reach Google Sheets" on submit | Phone has no internet, or a firewall/ad-blocker blocks `script.google.com`. Retry on mobile data. |
| "Google took too long" | Google was slow. Tap Register Connection again. The same registration ID is reused, so you can't get a duplicate row. |
| Saved but no row appears | You edited `Code.gs` but didn't create a **New version** of the deployment. Redeploy. |
| `Exception: Cannot find…` in Apps Script | `SPREADSHEET_ID` is wrong or the script's owner can't open that sheet. |
| "Too many registrations in a short time" | The soft rate limit tripped (150 per 5 minutes). Wait, or raise `RATE_LIMIT_MAX` in `Code.gs`. |
| Phone shows without `+` in the sheet | Run `setupSheet()` again so the columns are plain-text formatted. |
| Animations missing | Motion's CDN is blocked. Everything still works, just without animation. |

Open your browser's developer tools (F12 → Network) to see the request to `script.google.com` and its JSON reply.

## 7. Deploy the frontend (Netlify)

There is no build step.

- **Drag and drop:** [app.netlify.com/drop](https://app.netlify.com/drop), then drop the whole `church-connect` folder.
- **Or from Git:** push the folder to GitHub, then Netlify → *Add new site → Import from Git*. Build command: *(empty)*. Publish directory: `.` (already in `netlify.toml`).

Any static host (Cloudflare Pages, GitHub Pages, Vercel) works the same way.
Test on a real phone over mobile data before the first service.

## 8. Security limitations. Read before using real data.

This version deliberately has **no logins**, so ushers can work fast. That has consequences:

- **The endpoint is public.** Anyone who finds the Apps Script URL (it's visible in the site's JavaScript) can *submit* fake records. Hiding the URL is not security.
- **It cannot be used to read data.** `doGet` returns only a health check; there is no endpoint that returns registrations. The sheet itself is private to the people you share it with.
- **No secrets in the browser.** `config.js` contains only the public URL. Never put API keys or credentials there.
- **Server-side checks exist** (validation, size limit, honeypot field, locking, duplicate guards, and a soft global rate limit) but they are a speed bump, not a wall. The rate limit is global, not per person.
- **Spam/data pollution is the main risk.** Review the sheet regularly.
- **Everyone with the page link can open the form.** Don't publish the link; treat it like a church WiFi password. Consider an unguessable site name.
- **Consent is recorded as stated by the usher.** Make sure ushers ask first.

**Before you go live, do these:**

1. Share the Google Sheet only with named staff; don't use "anyone with the link".
2. Use a dedicated church Google account (not a personal one) to own the sheet and script.
3. Put the site on an unguessable address and don't link it publicly.
4. Add a church-specific privacy notice that matches your local data-protection obligations (in Nigeria, the NDPA 2023). Ask your leadership or a legal adviser to confirm wording and retention.
5. Check the sheet weekly for junk rows. If abuse appears, put a shared **access code** field in the form that the script checks (stored in Script Properties), or move to a signed-in deployment (Phase 2).
6. Back up the sheet (File → Make a copy) periodically, and delete records you no longer need.

## 9. Phase 2 ideas

- Admin dashboard for church leadership (needs sign-in).
- Email follow-up through a provider such as Brevo or SendGrid.
- SMS through a Nigerian provider (e.g. Termii or Africa's Talking).
- Automatic "thank you for visiting" messages and scheduled reminders for `Pending` rows.
- Follow-up team view to update status, date and notes without opening the sheet.

The Phase 1 sheet already stores consent, preferred method, status, date and notes, so none of this requires changing the registration form.
