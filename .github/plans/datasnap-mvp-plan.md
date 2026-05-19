# DataSnap MVP Implementation Plan

## Στόχος

Η υλοποίηση θα πατήσει πάνω στο υπάρχον skeleton με minimal refactor: κρατάμε το current `lib/` setup, προσθέτουμε `models/`, `services/`, `public/` και πλήρες `views/`, και κεντρώνουμε τη business logic σε ένα model `DatabaseJob` και σε dialect-aware backup services.

Το πλάνο αποφεύγει πρόωρη εξάρτηση από OS-specific binaries, αφήνοντας καθαρό provider boundary για MySQL/PostgreSQL dump generation με στόχο plain SQL output όσο γίνεται πιο συμβατό με restore μέσω DBeaver.

## Βασικές αποφάσεις

- Προτεινόμενο implementation style: minimal refactor, όχι πλήρης αναδιάρθρωση των υπαρχόντων `lib/` αρχείων.
- Προτεινόμενο persistence scope: ένα βασικό model `DatabaseJob` για το MVP, χωρίς ξεχωριστό backup-history table προς το παρόν.
- Προτεινόμενο routing style: το τυπικό route logic μένει στα route files και η σύνθετη validation/backup λογική πηγαίνει σε services.
- Προτεινόμενο backup architecture: dialect adapter boundary πρώτα, provider choice δεύτερα. Έτσι το app μένει portable ακόμα κι αν ένας dialect χρειαστεί αργότερα binary-backed implementation για καλύτερη συμβατότητα με DBeaver.
- Included scope: authentication μέσω env credentials, CRUD για job create/edit, dashboard, storage listing, download/delete, σειριακό `backup:all`, startup checks και UI shell.
- Excluded scope: cron setup, bulk delete/download, public file serving, per-attempt audit/history UI, automated tests και advanced scheduling UI.

## Φάσεις υλοποίησης

### 1. Stabilize the app shell

Review και adjust του bootstrap flow στο `server.js` ώστε:
- να παραμείνουν τα `/status`, `/health`. Το `/` θα γίνει redirect στο `/dashboard` αν ο χρήστης είναι authenticated, ή στο `/login` αν ο χρήστης δεν είναι authenticated (αυτό το χειρίζεται ήδη το αρχείο `auth.js`).
- να ενεργοποιηθεί σωστά το protected application area μετά το login
- να γίνουν register τα νέα routers για dashboard, job form και storage views
- να διορθωθεί το login flow που ήδη κάνει redirect σε `/dashboard`, route που σήμερα δεν υπάρχει

### 2. Align configuration contracts

Update του `package.json` με νέα scripts `backup:all` και προαιρετικά `backup:all:local`, και update του `config/.env` contract για `STORAGEPATH=storage`, `SYNCMODELS`, και τυχόν provider-related flags μόνο αν χρειαστούν πραγματικά.

Στόχος είναι ο επόμενος agent να μη σκορπίσει env assumptions μέσα στον κώδικα.

### 3. Fix known template/runtime blockers

Adjust του `config/handlebars.js` ώστε τα helpers να είναι ασφαλή για χρήση στα νέα views.

Ειδικά τα `label` και `labelEntries` σήμερα αναφέρονται σε `labels` που δεν έχει import, άρα είτε αφαιρούνται από το initial MVP είτε γίνονται harmless no-op για να μη σκάσει render όταν μπουν νέα templates.

### 4. Add the persistence layer

Create του `models/DatabaseJob.js` με όλα τα πεδία του job:
- `name`
- `description`
- `dialect`
- `host`
- `port`
- `dbName`
- `username`
- `password`
- `enabled`
- metadata τελευταίας απόπειρας backup όπως `lastBackupAt`, `lastBackupSucceededAt`, `lastBackupStatus`, `lastBackupMessage`

Το `name` θα είναι unique και θα έχει validation για folder-safe naming.

Δεν χρειάζεται δεύτερο model για backup history στο MVP, γιατί η λίστα των backup files θα προκύπτει από το storage.

### 5. Wire Sequelize aggregation

Create του `models/models.js` για:
- import/export του `DatabaseJob`
- central sync logic με `{ alter: JSON.parse(process.env.SYNCMODELS ?? 'false') }`
- ενιαίο `Models` object που θα χρησιμοποιούν routes και services

Αυτό είναι dependency για όλα τα CRUD και backup flows.

### 6. Add validation and backup services

Create service boundary για remote database probing και dump execution.

Προτεινόμενη διάσπαση:
- `services/database-job-validator.js` για validation κατά create/update
- `services/backup-service.js` για orchestration
- `services/backup-providers/mysql.js`
- `services/backup-providers/postgres.js`

Κάθε provider πρέπει να εκθέτει τουλάχιστον:
- `checkConnectivity`
- `checkReadAccess`
- `createDump`

Έτσι ο υψηλού επιπέδου κώδικας θα δίνει διακριτά errors για connectivity, authentication και permissions.

Αν για κάποιο dialect δεν υπάρξει αξιόπιστη pure Node λύση για DBeaver-compatible dump, το provider boundary επιτρέπει controlled fallback σε external binary χωρίς να αλλάξει το υπόλοιπο app.

### 7. Extend storage support for backup folders

Extend του `lib/storage.js` με helper methods προσανατολισμένα σε backups:
- resolve folder by job `name`
- ensure job folder exists
- build relative paths safely
- list files for one job
- delete one backup file

Το υπάρχον path safety logic πρέπει να παραμείνει ο κεντρικός μηχανισμός για download/delete routes.

### 8. Implement application routes

Create του `routes/databases.js` για dashboard και create/edit submit flow.

Το route file θα αναλάβει:
- `GET /dashboard`
- `GET /databases/new` ή αντίστοιχο create route
- `GET /databases/:id`
- `POST /databases`
- `POST /databases/:id`

Το route θα καλεί το validation service πριν από create/update ώστε να σώζονται μόνο jobs με αποδεδειγμένη read access.

Τα messages σφάλματος προς browser πρέπει να διαχωρίζουν καθαρά connectivity, authentication και permissions failure.

### 9. Implement backup file routes

Create του `routes/backups.js` για:
- `GET /databases/:id/storage`
- `GET /databases/:id/storage/:fileName/download`
- `POST /databases/:id/storage/:fileName/delete`

Το view θα διαβάζει τη λίστα αρχείων από το storage folder του job και όχι από DB table.

### 10. Keep login route consistent with new app area

Modify του `routes/login.js` για να αφαιρεθεί το duplicate `GET /login`, να μείνει ένα καθαρό render path για τη login view, και να συνεχίσει να κάνει redirect στο dashboard μετά από επιτυχές login.

### 11. Create the view system

Create των παρακάτω view files:
- `views/layouts/main.hbs`
- `views/layouts/basic.hbs`
- `views/login/login.hbs`
- `views/databases.hbs`
- `views/single-db.hbs`
- `views/single-db-storage.hbs`
- `views/partials/navigation.hbs`
- `views/partials/alerts.hbs`

Το `basic` layout θα χρησιμοποιείται μόνο για login, ενώ το `main` για όλη την authenticated εφαρμογή.

### 12. Add UI assets

Create των παρακάτω public assets:
- `public/css/main.css` με CSS variables για το σχετικά σκούρο blue/red theme και χρήση CSS layers
- `public/js/dimtables.js` για αναζήτηση, ταξινόμηση και pagination στον πίνακα jobs

Αν χρειαστεί μικρή page-specific συμπεριφορά στη φόρμα, να μπει inline module script μόνο στο σχετικό view και όχι global JS χωρίς λόγο.

### 13. Add the batch backup entrypoint

Create του `services/backup-all.js` ως thin script entrypoint που:
- φορτώνει models
- κάνει τον ίδιο αρχικό έλεγχο κύριας DB και storage με τον server bootstrap
- εκτελεί σειριακά όλα τα enabled jobs μέσω `backup-service.js`
- ενημερώνει τα status fields του `DatabaseJob` μετά από κάθε attempt

### 14. Surface the final UX and operational behavior

Ensure ότι το dashboard δείχνει:
- `id`
- `name`
- τελευταία επιτυχημένη ημερομηνία backup
- αποτέλεσμα τελευταίας απόπειρας
- κατάσταση enabled
- link προς storage view

Ensure επίσης ότι η φόρμα create/edit:
- καλύπτει όλα τα ζητούμενα fields
- εμφανίζει τα validation/runtime errors με κατανοητό τρόπο

Εκτός scope σε αυτή τη φάση είναι bulk actions, scheduling UI και πλήρες ιστορικό attempts σε ξεχωριστό table.

## Αρχεία που θα τροποποιηθούν

### `server.js`
Bootstrap flow, router registration, protected area wiring και startup checks.

### `package.json`
Νέα backup scripts και τυχόν dependency additions, π.χ. για MySQL connectivity.

### `config/.env`
Storage path, model sync flag και optional backup provider configuration.

### `config/handlebars.js`
Safe helper configuration για τα νέα templates.

### `routes/login.js`
Αφαίρεση duplicate GET handler και διατήρηση του redirect προς dashboard.

### `lib/auth.js`
Reuse του `validateCredentials` και του `validateUser` χωρίς structural changes.

### `lib/storage.js`
Extension με backup-folder/file helpers, διατηρώντας το υπάρχον path safety logic.

### `config/database.js`
Reuse του main Sequelize connection και του startup health check flow.

## Αρχεία που θα δημιουργηθούν

### `models/DatabaseJob.js`
Το βασικό persisted job definition με status metadata για την τελευταία απόπειρα backup.

### `models/models.js`
Model registry, unified `Models` export και central `syncModels` logic.

### `services/database-job-validator.js`
Validation του remote database connection κατά το save, με καθαρό διαχωρισμό connectivity, auth και permission failures.

### `services/backup-service.js`
Serial orchestration για backup ενός job ή όλων των enabled jobs.

### `services/backup-providers/mysql.js`
MySQL-specific probe και dump implementation.

### `services/backup-providers/postgres.js`
PostgreSQL-specific probe και dump implementation.

### `services/backup-all.js`
CLI entrypoint για το `npm run backup:all`.

### `routes/databases.js`
Dashboard, create, edit και save flows.

### `routes/backups.js`
List, download και delete backup files ανά job.

### `views/layouts/main.hbs`
Authenticated shell της εφαρμογής.

### `views/layouts/basic.hbs`
Login shell.

### `views/login/login.hbs`
Login form που περιμένει ήδη το υπάρχον route.

### `views/databases.hbs`
Jobs dashboard table.

### `views/single-db.hbs`
Create/edit job form.

### `views/single-db-storage.hbs`
Backup files list με download/delete actions.

### `views/partials/navigation.hbs`
Top navigation για το authenticated area.

### `views/partials/alerts.hbs`
Reusable success/error messaging.

### `public/css/main.css`
Theme variables, layout styling και table/form styling.

### `public/js/dimtables.js`
Table interactivity utility για το dashboard.

## Verification μετά την υλοποίηση

1. Run static validation στα touched files, ειδικά σε `server.js`, route files, model files και service files.
2. Confirm ότι το server startup συνεχίζει να περνά τα υπάρχοντα checks για main database και storage, χωρίς νέα boot-time failures.
3. Manual browser verification από εσένα για `/login`, redirect σε `/dashboard`, dashboard rendering, create/edit form rendering και storage view rendering.
4. Manual functional verification από εσένα με ένα reachable PostgreSQL job και ένα reachable MySQL job, ώστε το save να ξεχωρίζει connectivity, authentication και permissions failures πριν από το persist.
5. Manual backup execution από εσένα μέσω `npm run backup:all`, ώστε να επιβεβαιωθεί το serial flow, η ενημέρωση των `lastBackup...` fields και η δημιουργία αρχείων μέσα σε `storage/<job-name>/`.
6. Manual file-operation verification από εσένα για download και delete ενός backup file από το storage view χωρίς public exposure του storage folder.

## Further considerations

1. Η PostgreSQL dump strategy πρέπει να αξιολογηθεί νωρίς στην υλοποίηση. Προτίμηση σε plain SQL output και isolated provider ώστε τυχόν fallback σε `pg_dump` να μείνει τοπικό.
2. Το field naming πρέπει να κανονικοποιηθεί μία φορά στο model και να μείνει συνεπές σε routes και views. Προτείνεται persist του `dbName` στον κώδικα/model με καθαρό mapping από form field label `db_name`.
3. Αν η τελική υλοποίηση αλλάξει πιο επιθετικά τη folder structure από αυτό το plan, πρέπει να ενημερωθεί και το `.github/copilot-instructions.md`, γιατί το σημερινό repo ήδη αποκλίνει από το documented `utils/`-based structure.
