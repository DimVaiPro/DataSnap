import { db } from '../config/database.js';
import DatabaseJob from './DatabaseJob.js';
import log from '../lib/logger.js';

/**
 * Εκτελεί συγχρονισμό των models με τη βάση δεδομένων.
 * Χρησιμοποιεί alter: true αν SYNCMODELS=true, αλλιώς μόνο δημιουργεί νέους πίνακες.
 */
const syncModels = async () => {
    await db.sync({ alter: JSON.parse(process.env.SYNCMODELS ?? 'false') });
    log.system('Sequelize models synced successfully.');
};

/** Ενοποιημένο αντικείμενο με όλα τα models */
const Models = {
    DatabaseJob,
    syncModels,
};

export default Models;
