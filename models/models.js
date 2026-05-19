import { db } from '../config/database.js';
import DatabaseJob from './DatabaseJob.js';
import log from '../lib/logger.js';

/**
 * Εκτελεί συγχρονισμό των models με τη βάση δεδομένων.
 * Χρησιμοποιεί alter: true αν SYNCMODELS=true, αλλιώς μόνο δημιουργεί νέους πίνακες.
 */
const syncModels = async () => {
    const shouldAlter = process.env.SYNCMODELS === 'true';

    await db.sync({ alter: shouldAlter });

    if (shouldAlter) {
        log.success('Sequelize models synced successfully.');
    }
};

/** Ενοποιημένο αντικείμενο με όλα τα models */
const Models = {
    DatabaseJob,
    syncModels,
};

export default Models;
