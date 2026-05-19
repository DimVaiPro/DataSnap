import { db, databaseConnectionTest } from '../config/database.js';
import Storage from '../lib/storage.js';
import Models from '../models/models.js';
import { runAllBackups } from './backup-service.js';
import log from '../lib/logger.js';

async function main() {
    log.info("Εκκίνηση backup:all...");

    await databaseConnectionTest(db);
    await Storage.check();
    await Models.syncModels();

    await runAllBackups();

    log.info("Ολοκληρώθηκε το backup:all.");
    process.exit(0);
}

main().catch(error => {
    log.error(`Σφάλμα κατά την εκτέλεση backup:all: ${error}`);
    process.exit(1);
});
