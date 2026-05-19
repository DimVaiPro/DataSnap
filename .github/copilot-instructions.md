# copilot-instructions.md

## Γενικές Οδηγίες
Το όνομά μου είναι Δημήτρης. Να μου μιλάς στον ενικό και στα ελληνικά. Μην ξεκινάς κάποιο server μετά από κάποια αλλαγή διότι ο server τρέχει τοπικά στον υπολογιστή μου - Ζήτησέ μου να ελέγξω εγώ αν κάτι δουλεύει ή όχι. Μην υλοποιήσεις κώδικα για testing.

Έχω βάλει κάποια αρχεία από άλλη εφαρμογή που έχω φτιάξει, οπότε μπορεί να δεις άσχετα πράγματα. Μπορείς να τα διαγράψεις αν δεν χρειάζονται, αλλά έλεγξε το στυλ τους και ακολούθησέ το για να είναι ομοιόμορφο με το υπόλοιπο project.

## Περιγραφή εφαρμογής
Θα φτιάξουμε μια εφαρμογή node.js που θα κάνει backup βάσεις δεδομένων σε αρχεία. Οι βάσεις θα είναι MySQL και PostgreSQL (για τώρα).

Δες το αρχείο .env. Χρησιμοποιώ PostgreSQL για αποθήκευση των data. Να χρησιμοποιηθεί το Sequelize. 

Επειδή θα είμαι ο μόνος χρήστης, η εφαρμογή θα χρησιμοποιεί τα process.env.USEREMAIL και το process.env.PASSWORD για είσοδο/authentication.

Θα περιλαμβάνει 2 βασικά views (εκτός από το view του login). Ένα πίνακα/dashboard με όλες τις βάσεις δεδομένων / jobs που θα έχουν δηλωθεί (`databases.hbs`) και ένα για δημιουργία/επεξεργασία νέου job (`single-db.hbs`).

Το view επεξεργασίας του job/βάσης, θα περιέχει τα πεδία: name (Ονομασία για την εφαρμογή), description, dialect (`<select>` με MySQL - PostgreSQL), host, port, db_name, username, password, enabled (αν είναι ενεργή η λήψη backup). Κατά τη δημιουργία ή την αποθήκευση, θα ελέγχεται ότι υπάρχουν δικαιώματα SELECT σε αυτή τη βάση και μόνο τότε θα γίνεται η δημιουργία/αποθήκευση. Αλλιώς ο server θα επιστρέφει μήνυμα λάθους στον browser διευκρινίζοντας αν το error είναι θέμα συνδεσιμότητας, θέμα authentication ή θέμα δικαιωμάτων (SELECT ή αντίστοιχο query για λήψη backup). 
Προς το παρόν, μέχρι να βεβαιωθώ ότι λειτουργούν όλα σωστά, το κάθε password θα αποθηκεύεται ως plain text στη βάση. 

Το backup θα γίνεται σε μορφή που μπορεί να γίνει restore μέσω του dbeaver. Η αποθήκευση θα γίνεται σε αρχεία μέσα στο φάκελο process.env.STORAGEPATH (που by default θα είναι STORAGEPATH=storage, δηλαδή ο φάκελος /storage στο project). Για κάθε όνομα/name της βάσης, θα υπάρχει ο αντίστοιχος φάκελος μέσα στο /storage, με αυτό το name (ναι, με το name του, όχι με το id του). Πχ /storage/myfirstDatabase. Συνεπώς το πεδίο name για κάθε βάση θα έχει τους αντίστοιχους περιορισμούς (κατά προτίμηση, μόνο πεζά γράμματα - ελληνικά ή λατινικά, και βασικά σύμβολα που επιτρέπονται σε ονόματα φάκελων, όπως παύλες κλπ, αλλά όχι κενά ή περίεργοι χαρακτήρες).

Συνεπώς, θα υπάρχει για κάθε βάση name ένα στοιχειώδες view `single-db-storage.hbs` που θα παρουσιάζει τα backups που έχουν παρθεί και θα δίνει τη δυνατότητα download τους ή διαγραφή τους (για τώρα αρκεί ένα-ένα, όχι μαζικά).  

To job θα εκτελείται με κάποια εντολή `npm run backup:all`, η οποία θα ρυθμιστεί να εκτελείται με cron job. Δεν σε αφορά το cron job, αρκεί να παίρνονται backup όλες οι βάσεις όταν τρέχει αυτή η εντολή.

Κατά την έναρξη του server και του cron job, θα ελέγχεται πρώτα η σύνδεση με την κύρια βάση της εφαρμογής και η ύπαρξη του φάκελου storage με δικαιώματα read/write, κάνοντας το αντίστοιχο log στο console. Τα backup θα παίρνονται σειριακά, όχι παράλληλα, και για κάθε job/backup, πρώτα θα ελέγχεται η δυνατότητα select στη βάση και μετά θα παίρνεται το backup, ώστε να γνωρίζουμε σε περίπτωση λάθους αν πρόκειται για θέμα συνδεσιμότητας/authentication ή θέμα δικαιωμάτων (select ή αντίστοιχο query για λήψη backup).

Το view/dashboard `databases.hbs` που θα περιέχει τον πίνακα θα αναγράφει το id του job, το όνομα της βάσης/job, η ημερομηνία του τελευταίου επιτυχημένου backup, αν το τελευταίο backup που επιχειρήθηκε ήταν πετυχημένο ή όχι, ένα link για το view με τα ληφθέντα backup, και αν είναι ενεργό ή όχι. Φυσικά θα υπάρχει το κουμπί δημιουργίας νέου job/backup.

Εμφάνιση: Σχετικά σκούρο θέμα (όχι πολύ σκούρο), κατά προτίμηση με αποχρώσεις του μπλε και του κόκκινου. Τα χρώματα να γίνουν css variables ώστε να μπορούν να τροποποιηθούν έυκολα.

## General Style
- The project uses `node.js/express` 
- Use `express` and `express-handlebars`. The handlebar helpers are defined in `config/handlebars.js`. 
- Use modern JavaScript (ES6+).
- Use `import`/`export` syntax. Do not use `require` or `module.exports`.
- Prefer concise and clean code, with clear structure over clever one-liners.
- Avoid over-engineering and unnecessary abstraction.

## Project Structure
- Entry point of the app is `server.js`, not `index.js`.
- Follow MVC architecture.
- Directory structure includes:
  - `public/` for static assets.
  - `views/` with subfolder `partials/` for handlebars partials (e.g., header, footer) and `layouts/` for main layout files.
  - `routes/` for route definitions. Prefer one router file per resource (e.g., users.js, roles.js). Prefer writing the logic in routes instead of controllers unless the logic is too complex.
  - `controllers/` for middleware logic. Write controller logic here only if it is too complex to be handled in routes.
  - `models/` for Sequelize models (one model per file). Use `models/models.js` to import all other models, define associations, `sync` using `{alter: JSON.parse(process.env.SYNCMODELS)}`, and export all as `Models`.
  - `config/` for configuration files (e.g., handlebars.js, database.js, security.js, mail.js, .env).
  - `services/` for scripts that run tasks, for example cron jobs, using `npm run <script>` commands. For a job, create a separate file (in `services` or `controllers`) with the function and import it into the script file. The script file should only execute the function. So, the function can be reused elsewhere if needed.
  - `storage/` for uploaded files if needed.
  - `public/storage/` for serving publicly available uploaded files if needed.


## Database
- Use `Sequelize` with `PostgreSQL`.
- Define each model in a separate file in the `models/` folder.
- Relationships and `sequelize.sync()` logic go into `models.js` not into each model file.
- Export a unified `Models` object from `models.js` (e.g., `Models.User`, `Models.Organization`).
- Τα indexes να δηλώνονται στο πεδίο `indexes` του model, όχι σε κάθε πεδίο ξεχωριστά. Μην ξεχνάς, όταν βάζεις σύνθετο index, να του δίνεις name, διότι σε κάθε `db.sync()` θα δημιουργείται επιπλέον duplicate index. 
- Υπάρχει ένα "model" `Cache` με πρόσβαση μέσω `await Cache.table.ModelName` (επιστρέφει array με records), `await Cache.map.ModelName` (επιστρέφει `Map<id, record>` για γρήγορη αναζήτηση), και `Cache.refresh(modelName)` για ανανέωση του cache. Αν το model έχει πεδίο `active`, τότε επιστρέφονται μόνο τα active records. Χρησιμοποίησε το για δεδομένα που δεν αλλάζουν συχνά και εμφανίζονται σε πολλές σελίδες (πχ Departments, Users) για παράδειγμα ως dropdown lists. Μην χρησιμοποιείς cache στις σελίδες διαχείρισης των ίδιων των δεδομένων (πχ /admin/departments, /admin/users/) ώστε σε αυτές να εμφανίζονται και τα inactive records. Το `Cache` είναι το μόνο που γίνεται απευθείας import από το `models/cache.js` και όχι μέσω του `models/models.js`.

## Storage
- Χρήση `multer` για τη διαχείριση των ανεβάσματος αρχείων.
- Αποθήκευση των αρχείων στον τοπικό δίσκο μέσα στο φάκελο `storage/`. H διαχείριση των αρχείων γίνεται μέσω του utility `Storage` από το `utils/storage.js`.
- Δεν υπάρχουν δημόσια προσβάσιμα αρχεία. Φρόντισε τα αρχεία να μην μπορούν να προσπελαστούν χωρίς authentication. 

## Coding Practices
- Use `async`/`await` for asynchronous operations.
- Use custom logger function defined in `utils/logger.js` for logging instead of `console.log`. Have in mind that this logger takes only one argument (so use template literals for multiple values).
- Use single quotes for strings that are critical to the code’s logic (e.g., object keys, SQL queries). Use double quotes for strings that can be changed freely without affecting functionality (e.g., UI text, log messages).
- Avoid checking for null/undefined before accessing object properties. Use optional chaining (`obj?.prop`) if possible.
- Avoid cheking for object types or existance before using them. Assume the data is correct unless there is a specific reason to validate it. For example, DO NOT use `if (typeof varName === 'string')` or `if (typeof confetti === 'undefined')` or `if (Array.isArray(varName))`. Instead, you can use `if (myArray.length)` or other checks that verify the content, not the type.

## Naming Conventions
- Use `camelCase` for variables and functions. Maybe use `PascalCase` for very impotant objects.
- Use `PascalCase` for class names and Sequelize models.
- Use full names for variables and functions to improve readability. Avoid abbreviations unless they are widely recognized (e.g., `id`, `url`). For example, prefer `destinationPath` over `destPath` and `originalFileName` over `origName`.
- Use descriptive names for functions that indicate their purpose (e.g., `getUserById`, `calculateComplianceScore`).

## Code Formatting
- Use semicolons at the end of statements.
- Use four spaces for indentation.
- Use trailing commas in multi-line objects and arrays.

## Frontend
- Use defer for all JavaScript files and put them in the <head>, not at the end of the body.
- Use CSS layers. If you want to use Bootstrap CSS, put it in the `framework` layer. 
- Avoid inline CSS. Use external CSS files in `public/css/`. Prefer element classes from Bootstrap, if possible.
- Prefer reusing the same custom CSS classes for similar elements. Do not create multiple similar classes for different elements; If needed (different margin for example), modify them with additional utility classes.
- Use `Alpine.js` only when interactivity is needed. Do not use heavy JS frameworks like React.
- You can use inline JavaScript in `<script type="module">` tags within Handlebars views, at the end of the view file, if the logic is applied only to a specific view. Use <script> without `type="module"` for Alpine.js logic, so it is available when alpine initalizes. 
- Keep frontend logic simple and enhance progressively only when necessary.


## Frontend Design
- Follow the existing design patterns of Bootstrap 5, if you decide to use it.
- There are 2 main types of content in views. Tables for showing multiple records and Forms for creating/editing single records.
- When creating a new view, look for similar existing views (with the appropriate type, table type or form type) and follow their structure and design.
- In tables, use dimtables.js, defined in `public/js/dimtables.js`, for table interactivity (search, pagination, sorting). 

## Comments & Documentation
- Use `JSDoc` comments for all exported functions, classes, and objects.
- For internal-only functions, use a short inline comment to describe the purpose.
- Write comments in Greek.
- Comment blocks of code, not single lines.
- Do not add comments when you make a correction or add something new and the modification is only a few lines different. Add comment only if you add a whole new block of logic. 
- Prefer self-documenting code over verbose comments.
- Do not overcomment obvious logic.

## Don'ts
- Don't use `require`.
- Don't use frontend frameworks (React, Vue, etc.).
- Don't define model relationships inside individual model files.
- Don't add routes or controller logic directly inside `server.js` for large apps.

## Αλλαγές
Αν δεις ότι υλοποιούμε κάτι που αλλάζει τις παραπάνω οδηγίες (copilot-instructions.md), πες μου να τις αλλάξουμε για να είναι ενημερωμένες.