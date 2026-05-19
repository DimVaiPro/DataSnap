import { Router } from 'express';
import Models from '../models/models.js';
import validateDatabaseJob from '../services/database-job-validator.js';
import log from '../lib/logger.js';

const router = Router();

// Χαρτογράφηση errorType σε ελληνικό label
const errorTypeLabels = {
    connectivity: 'Σφάλμα συνδεσιμότητας',
    authentication: 'Σφάλμα πιστοποίησης (λάθος username/password)',
    permissions: 'Σφάλμα δικαιωμάτων (δεν επιτρέπεται η ανάγνωση)',
};

// Μετατρέπει τα form data σε αντικείμενο κατάλληλο για το model
function parseFormData(body) {
    return {
        name: body.name?.trim() ?? '',
        description: body.description?.trim() || null,
        dialect: body.dialect,
        host: body.host?.trim() ?? '',
        port: parseInt(body.port) || 5432,
        dbName: body.dbName?.trim() ?? '',
        username: body.username?.trim() ?? '',
        password: body.password ?? '',
        enabled: body.enabled === 'on',
    };
}

// GET /dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const jobs = await Models.DatabaseJob.findAll({ order: [['id', 'ASC']] });
        res.render('databases', { jobs: jobs.map(j => j.toJSON()) });
    } catch (error) {
        log.error(`Dashboard error: ${error}`);
        res.render('databases', { jobs: [], error: 'Σφάλμα φόρτωσης δεδομένων.' });
    }
});

// GET /databases/new
router.get('/databases/new', (req, res) => {
    res.render('single-db', { isNew: true, job: { dialect: 'postgres', port: 5432, enabled: true } });
});

// GET /databases/:id
router.get('/databases/:id', async (req, res) => {
    try {
        const job = await Models.DatabaseJob.findByPk(req.params.id);
        if (!job) return res.status(404).render('single-db', { error: 'Το job δεν βρέθηκε.' });
        res.render('single-db', { job: job.toJSON() });
    } catch (error) {
        log.error(`Get job error: ${error}`);
        res.status(500).render('single-db', { error: 'Σφάλμα φόρτωσης.' });
    }
});

// POST /databases (δημιουργία)
router.post('/databases', async (req, res) => {
    const formData = parseFormData(req.body);

    const validation = await validateDatabaseJob(formData);
    if (!validation.success) {
        const label = errorTypeLabels[validation.errorType] ?? 'Σφάλμα';
        return res.render('single-db', {
            isNew: true,
            job: formData,
            error: `${label}: ${validation.message}`,
        });
    }

    try {
        await Models.DatabaseJob.create(formData);
        res.redirect('/dashboard');
    } catch (error) {
        log.error(`Create job error: ${error}`);
        const message = error.name === 'SequelizeUniqueConstraintError'
            ? 'Υπάρχει ήδη job με αυτό το όνομα.'
            : (error.errors?.[0]?.message ?? error.message);
        res.render('single-db', { isNew: true, job: formData, error: message });
    }
});

// POST /databases/:id (ενημέρωση)
router.post('/databases/:id', async (req, res) => {
    const formData = parseFormData(req.body);

    const validation = await validateDatabaseJob(formData);
    if (!validation.success) {
        const label = errorTypeLabels[validation.errorType] ?? 'Σφάλμα';
        return res.render('single-db', {
            job: { ...formData, id: req.params.id },
            error: `${label}: ${validation.message}`,
        });
    }

    try {
        const job = await Models.DatabaseJob.findByPk(req.params.id);
        if (!job) return res.status(404).render('single-db', { error: 'Το job δεν βρέθηκε.' });
        await job.update(formData);
        res.redirect('/dashboard');
    } catch (error) {
        log.error(`Update job error: ${error}`);
        const message = error.name === 'SequelizeUniqueConstraintError'
            ? 'Υπάρχει ήδη job με αυτό το όνομα.'
            : (error.errors?.[0]?.message ?? error.message);
        res.render('single-db', { job: { ...formData, id: req.params.id }, error: message });
    }
});

export default router;
