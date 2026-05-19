# DataSnap

Εφαρμογή Node.js για λήψη και αποθήκευση SQL backup jobs από εξωτερικές βάσεις δεδομένων, με στόχο το χειροκίνητο restore μέσω DBeaver.

## Υποστηριζόμενες βάσεις

- MySQL
- PostgreSQL

## Τι περιλαμβάνουν τα backups

- Data: ναι
- Πίνακες: ναι
- Views: όχι
- Indexes: ναι
- Relationships / associations: ναι, σε επίπεδο foreign keys
- PostgreSQL sequences: ναι

## Απαιτούμενα δικαιώματα χρήστη ανά βάση

- MySQL: δικαιώματα σύνδεσης, `SELECT` στους πίνακες της βάσης και δυνατότητα ανάγνωσης του ορισμού των πινάκων
- PostgreSQL: δικαιώματα σύνδεσης, `SELECT` στους πίνακες της βάσης και δυνατότητα ανάγνωσης των metadata/schema πληροφοριών που απαιτούνται για το dump
