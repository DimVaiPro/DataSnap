import log from '../lib/logger.js';
import Storage from '../lib/storage.js';
import Models from '../models/models.js';
import * as postgresProvider from './backup-providers/postgres.js';
import * as mysqlProvider from './backup-providers/mysql.js';

const providers = {
    postgres: postgresProvider,
    mysql: mysqlProvider,
};

// Δημιουργεί timestamp-based filename για backup
function generateBackupFileName(dbName) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${dbName}_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.sql`;
}

/**
 * Εκτελεί backup για ένα DatabaseJob.
 * Ελέγχει πρώτα τα δικαιώματα SELECT και μετά παράγει και αποθηκεύει το dump.
 * @param {object} job - Sequelize instance DatabaseJob
 * @returns {{ success: boolean, fileName?: string, message?: string }}
 */
export const runBackupForJob = async (job) => {
    const provider = providers[job.dialect];
    if (!provider) {
        const message = `Άγνωστος τύπος βάσης: ${job.dialect}`;
        log.error(`Job "${job.name}": ${message}`);
        return { success: false, message };
    }

    log.info(`Εκκίνηση backup job "${job.name}" (${job.dialect})...`);

    // Έλεγχος πρόσβασης πριν από το dump
    const accessCheck = await provider.checkReadAccess(job);
    if (!accessCheck.success) {
        const typeLabel = { connectivity: 'Σφάλμα συνδεσιμότητας', authentication: 'Σφάλμα πιστοποίησης', permissions: 'Σφάλμα δικαιωμάτων' }[accessCheck.errorType] ?? 'Σφάλμα';
        const message = `${typeLabel}: ${accessCheck.message}`;
        log.error(`Job "${job.name}": ${message}`);
        await job.update({ lastBackupAt: new Date(), lastBackupStatus: 'failed', lastBackupMessage: message });
        return { success: false, message };
    }

    // Δημιουργία dump
    let dumpContent;
    try {
        dumpContent = await provider.createDump(job);
    } catch (error) {
        const message = `Σφάλμα δημιουργίας dump: ${error.message}`;
        log.error(`Job "${job.name}": ${message}`);
        await job.update({ lastBackupAt: new Date(), lastBackupStatus: 'failed', lastBackupMessage: message });
        return { success: false, message };
    }

    // Αποθήκευση αρχείου
    try {
        const fileName = generateBackupFileName(job.name);
        await Storage.job.save(job.name, fileName, dumpContent);

        const now = new Date();
        await job.update({
            lastBackupAt: now,
            lastBackupSucceededAt: now,
            lastBackupStatus: 'success',
            lastBackupMessage: `Backup "${fileName}" αποθηκεύτηκε επιτυχώς`,
        });

        log.success(`Job "${job.name}": backup ολοκληρώθηκε → "${fileName}"`);
        return { success: true, fileName };
    } catch (error) {
        const message = `Σφάλμα αποθήκευσης: ${error.message}`;
        log.error(`Job "${job.name}": ${message}`);
        await job.update({ lastBackupAt: new Date(), lastBackupStatus: 'failed', lastBackupMessage: message });
        return { success: false, message };
    }
};

/**
 * Εκτελεί σειριακά backup για όλα τα enabled DatabaseJobs.
 */
export const runAllBackups = async () => {
    const jobs = await Models.DatabaseJob.findAll({ where: { enabled: true } });

    if (!jobs.length) {
        log.info("Δεν βρέθηκαν ενεργά backup jobs.");
        return;
    }

    log.info(`Εκκίνηση backup για ${jobs.length} job(s)...`);

    for (const job of jobs) {
        await runBackupForJob(job);
    }

    log.info("Ολοκληρώθηκαν όλα τα backup jobs.");
};
