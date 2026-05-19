# DataSnap

Εφαρμογή Node.js για λήψη και αποθήκευση SQL backup jobs από εξωτερικές βάσεις δεδομένων, με στόχο το χειροκίνητο restore μέσω DBeaver.

## Υποστηριζόμενες βάσεις

- MySQL
- PostgreSQL

## Τι περιλαμβάνουν τα backups

- Data: ναι
- Πίνακες: ναι
- Views: ναι
- Indexes: ναι
- Relationships / associations: ναι, σε επίπεδο foreign keys
- PostgreSQL sequences: ναι

## Τι δεν υποστηρίζεται επί του παρόντος

- Triggers
- Stored procedures / functions
- User permissions / grants
- Ownership / users / roles
- PostgreSQL: άλλα schemas εκτός από το `public`
- PostgreSQL: extensions, policies, materialized views, check constraints και άλλοι πιο εξειδικευμένοι τύποι constraints
- MySQL: events
- View dependency ordering: δεν γίνεται ακόμη ειδική ταξινόμηση όταν ένα view βασίζεται σε άλλο view

## Απαιτούμενα δικαιώματα χρήστη ανά βάση

- MySQL: δικαιώματα σύνδεσης, `SELECT` στους πίνακες της βάσης και δυνατότητα ανάγνωσης του ορισμού πινάκων και views
- PostgreSQL: δικαιώματα σύνδεσης, `SELECT` στους πίνακες της βάσης και δυνατότητα ανάγνωσης των metadata/schema πληροφοριών που απαιτούνται για το dump, συμπεριλαμβανομένων των view definitions
