# Alumni Mentorship Matcher

A mentorship platform where students find alumni mentors, send requests, chat, book meetings and leave reviews. The database does the heavy lifting: business rules live in triggers and stored procedures, and the admin analytics are built from views, window functions and CTEs.

Built for 23CSE202 Database Management Systems, Amrita School of Computing, Amritapuri.

## Database

Twelve tables in BCNF.

| Table | Holds |
|---|---|
| users | Every account. Role is student, alumni or admin |
| alumni_details | Mentor capacity (status, maximum mentees, preferred hours) and verification (status, graduation year, department, verified by, verified at) |
| availability_slots | Weekly time slots a mentor offers |
| skills, user_skills | Skill catalogue and the many-to-many link to users |
| mentorship_requests | A student's request to a mentor and its status |
| messages | Chat inside an accepted match |
| meetings | Scheduled, completed or cancelled meetings |
| reviews | One rating per completed meeting |
| notifications | Per-user alerts raised by triggers |
| audit_log | Who changed what, written by triggers |
| sessions | Login tokens with an expiry |

### Rules enforced inside MySQL

| Rule | How |
|---|---|
| Only students send requests, only to alumni, only to mentors who are active and verified | BEFORE INSERT trigger on mentorship_requests |
| No duplicate open request to the same mentor | Same trigger |
| A mentor cannot accept past max_mentees | BEFORE UPDATE trigger, run inside sp_respond_request with a row lock |
| A closed request cannot be reopened | BEFORE UPDATE trigger |
| Chat only between the two people of an accepted match | BEFORE INSERT trigger on messages |
| Meetings only for accepted matches, only in the future | BEFORE INSERT trigger on meetings |
| A meeting starts as a proposal and the other person has to accept it | sp_set_meeting_status plus BEFORE UPDATE trigger on meetings |
| Nobody can hold two overlapping meetings | Overlap query inside the BEFORE INSERT trigger |
| A video call link is always present: the given one, or a generated room | sp_book_meeting |
| A meeting cannot be completed before it starts | BEFORE UPDATE trigger on meetings |
| Reviews only for completed meetings, one per meeting | Trigger and UNIQUE on reviews.meeting_id |
| Ratings 1 to 5, durations 15 to 180 minutes, mentees 1 to 20 | CHECK constraints |
| Admin accounts cannot be deleted | BEFORE DELETE trigger on users |
| Session expiry set at login | BEFORE INSERT trigger on sessions |

### Views, functions and procedures

- Views: v_active_matches, v_pending_queue, v_mentor_load, v_monthly_requests, v_skill_demand
- Function: fn_match_score counts the skills a student and a mentor share
- Procedures: sp_send_request, sp_respond_request (transaction with SELECT ... FOR UPDATE), sp_cancel_match, sp_book_meeting, sp_set_meeting_status, sp_submit_review, sp_recommend_mentors (RANK window function)
- Admin analytics use a CTE with RANK() OVER (PARTITION BY focus_track ...), a LEFT JOIN to find mentors with no requests, and the monthly view

### Migrations

SQL lives in `backend/db/sql`. `npm run migrate` applies each numbered file once (004 adds the meeting proposal columns, 005 fills the skill catalog, 006 adds alumni verification), records it in `schema_migrations`, and re-applies the `R__` file that holds triggers, views and procedures.

## Frontend

Static HTML, CSS and vanilla JavaScript, no build step. The landing page has three scroll-driven scenes: a hero image that shrinks into a rounded card, a fixed linen backdrop with text passing over it, and a slanted band that widens until it fills the screen. All artwork is drawn on canvas in `art.js`, fonts are self-hosted in `fonts/`, and `prefers-reduced-motion` turns the effects off.

| File | Role |
|---|---|
| core.js | API client, session in localStorage, navigation, dialogs, toasts |
| landing.js | Scroll scenes, live figures from `/api/public/summary`, sign in and register |
| pages.js | One controller per app page |
| styles.css | Design tokens and every component |

On localhost the frontend calls `http://localhost:3000/api`. Anywhere else it calls the Render URL set at the top of `core.js`. Serve the folder with any static server, for example `python3 -m http.server 5500`.

## Running locally

Requires Node.js 18+ and MySQL 8.

```
cd backend
npm install
```

Create `backend/.env`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=alumni_matcher
PORT=3000
```

Create the database, then migrate and seed:

```
mysql -u root -p -e "CREATE DATABASE alumni_matcher"
npm run migrate
npm run seed
npm run seed:demo
npm start
```

`npm start` runs the migrations first, so a deploy always brings the database up to date.

`seed` creates the admin account. `seed:demo` adds 10 mentors, 24 students, requests, meetings, reviews and chat history. Demo accounts use the password `password123`, for example `priya.nair` or `aditya.kumar`.

Tests:

```
npm run test:db
npm run test:api
```

`test:db` exercises every trigger, procedure and view. `test:api` runs the full API with the server running.

## Known limitations

- Chat is polled, not pushed
- Meeting times are stored in UTC and shown in the viewer's local time
- Free hosting tiers sleep when idle
