import * as postgresProvider from './backup-providers/postgres.js';
import * as mysqlProvider from './backup-providers/mysql.js';

const providers = {
    postgres: postgresProvider,
    mysql: mysqlProvider,
};

/**
 * Ελέγχει τη σύνδεση και τα δικαιώματα SELECT ενός DatabaseJob.
 * Επιστρέφει { success, errorType?, message? } με errorType: 'connectivity' | 'authentication' | 'permissions'
 * @param {object} job - Αντικείμενο με host, port, dbName, username, password, dialect
 * @returns {{ success: boolean, errorType?: string, message?: string }}
 */
const validateDatabaseJob = async (job) => {
    const provider = providers[job.dialect];
    if (!provider) {
        return { success: false, errorType: 'connectivity', message: `Άγνωστος τύπος βάσης: ${job.dialect}` };
    }
    return provider.checkReadAccess(job);
};

export default validateDatabaseJob;
