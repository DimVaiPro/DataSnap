import { Router } from 'express';
import Models from '../models/models.js';
import Storage from '../lib/storage.js';
import log from '../lib/logger.js';

const router = Router();

// GET /databases/:id/storage - λίστα backup αρχείων
router.get('/databases/:id/storage', async (req, res) => {
    try {
        const job = await Models.DatabaseJob.findByPk(req.params.id);
        if (!job) return res.status(404).render('single-db-storage', { error: 'Το job δεν βρέθηκε.' });

        const files = await Storage.job.list(job.name);
        res.render('single-db-storage', { job: job.toJSON(), files });
    } catch (error) {
        log.error(`Storage list error: ${error}`);
        res.status(500).render('single-db-storage', { error: 'Σφάλμα φόρτωσης αρχείων.' });
    }
});

// GET /databases/:id/storage/:fileName/download
router.get('/databases/:id/storage/:fileName/download', async (req, res) => {
    try {
        const job = await Models.DatabaseJob.findByPk(req.params.id);
        if (!job) return res.status(404).send('Το job δεν βρέθηκε.');

        const absolutePath = await Storage.job.downloadPath(job.name, req.params.fileName);
        res.download(absolutePath);
    } catch (error) {
        log.error(`Download error: ${error}`);
        res.status(404).send('Το αρχείο δεν βρέθηκε.');
    }
});

// POST /databases/:id/storage/:fileName/delete
router.post('/databases/:id/storage/:fileName/delete', async (req, res) => {
    try {
        const job = await Models.DatabaseJob.findByPk(req.params.id);
        if (!job) return res.status(404).send('Το job δεν βρέθηκε.');

        await Storage.job.delete(job.name, req.params.fileName);
        res.redirect(`/databases/${req.params.id}/storage`);
    } catch (error) {
        log.error(`Delete backup error: ${error}`);
        res.status(500).send('Σφάλμα διαγραφής αρχείου.');
    }
});

export default router;
