import log from './logger.js';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';



/**
 * Ελέγχει ότι το absolutePath βρίσκεται εντός του storage φακέλου.
 * @param {string} absolutePath - Απόλυτο path προς έλεγχο
 * @param {boolean} allowRoot - Αν true, επιτρέπεται και το ίδιο το storagePath
 */
function assertInStorage(absolutePath, allowRoot = false) {
    const isRoot = absolutePath === Storage.storagePath;
    const isInside = absolutePath.startsWith(Storage.storagePath + path.sep);
    if (!isInside && !(allowRoot && isRoot)) {
        throw new Error('Μη επιτρεπτό path');
    }
}

/**
 * Ελέγχει αν υπάρχει φάκελος στο συγκεκριμένο absolute path και επιστρέφει true/false.
 * @param {string} absolutePath - Απόλυτο path φακέλου προς έλεγχο
 * @returns {boolean} Αν ο φάκελος υπάρχει
 */
async function directoryExists(absolutePath) {
    try {
        const stats = await fs.stat(absolutePath);
        return stats.isDirectory();
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return false;
        }

        throw error;
    }
}



/**
 * Διαχείριση αποθηκευτικού χώρου.
 */
const Storage = {};

/** Θέση του φάκελου Storage */
Storage.storagePath = path.resolve(process.cwd(), process.env.STORAGEPATH ?? 'storage');

Storage.errorCodes = {
    duplicateFile: 'STORAGE_DUPLICATE_FILE',
};

Storage.sanitizer = {
    symbol: '~',
    sanitize(fileName) {
        if (!fileName) { throw new Error('filename missing') }
        return fileName.replaceAll(' ', Storage.sanitizer.symbol);
    },
    desanitize(fileName) {
        if (!fileName) { throw new Error('filename missing') }
        return fileName.replaceAll(Storage.sanitizer.symbol, ' ');
    },
};

/**
 * Ελέγχει αν ο φάκελος Storage υπάρχει και έχει δικαιώματα read/write.
 * Καλείται κατά την εκκίνηση του server.
 */
Storage.check = async function(logResult=true) {
    try {
        await fs.access(Storage.storagePath, constants.R_OK | constants.W_OK);
        if (logResult) log.system(`Ο φάκελος Storage βρίσκεται στη θέση: ${Storage.storagePath}`);
    } catch {
        log.error(`Δεν είναι δυνατή η πρόσβαση στον φάκελο Storage: ${Storage.storagePath}`);
        throw new Error(`Storage folder inaccessible: ${Storage.storagePath}`);
    }
}

/**
 * Επιστρέφει τα περιεχόμενα ενός φακέλου (αρχεία & υποφάκελοι) σε μορφή { folders: ['array'], files: ['array'] }.
 * Αν ο φάκελος δεν υπάρχει, επιστρέφει { folders: [], files: [] }.
 * Όταν desanitize=true, εφαρμόζει desanitize στα ονόματα των αρχείων.
 * Για τα αρχεία επιστρέφεται και η ημερομηνία δημιουργίας τους στο storage.
 * @param {string} folderPath - Σχετικό path ως προς το storagePath
 * @param {boolean} desanitize - Αν true, γίνεται desanitize μόνο στο πεδίο name των αρχείων
 * @param {boolean} showPath - Αν true, επιστρέφεται και το σχετικό path κάθε item
 * @returns {{ folders: Array, files: Array }}
 */
Storage.list = async function(folderPath = '', desanitize = true, showPath = false) {
    const targetPath = path.resolve(Storage.storagePath, folderPath);
    assertInStorage(targetPath, true);

    if (!await directoryExists(targetPath)) {
        return { folders: [], files: [] };
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const folders = [];
    const files = [];

    for (const entry of entries) {
        const relativePath = folderPath ? `${folderPath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            folders.push({ 
                name: entry.name, 
                path: showPath ? relativePath : undefined 
            });
        } else if (entry.isFile()) {
            const stat = await fs.stat(path.join(targetPath, entry.name));
            const fileName = desanitize ? Storage.sanitizer.desanitize(entry.name) : entry.name;
            files.push({
                name: fileName,
                path: showPath ? relativePath : undefined,
                size: stat.size,
                createdAt: stat.birthtime.toISOString(),
            });
        }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    return { folders, files };
};

/**
 * Επιστρέφει το απόλυτο path ενός αρχείου αφού ελέγξει ότι βρίσκεται εντός storage, με σκοπό το download του.
 * Χρήση σε route: res.download(await Storage.path(filePath));
 * @param {string} filePath - Σχετικό path ως προς το storagePath
 * @returns {string} Απόλυτο path του αρχείου
 */
Storage.path = async function(filePath) {
    const targetPath = path.resolve(Storage.storagePath, filePath);
    assertInStorage(targetPath);

    await fs.access(targetPath, constants.R_OK);
    return targetPath;
};

/**
 * Διαγράφει ένα αρχείο ή φάκελο (μαζί με τα περιεχόμενά του).
 * @param {string} targetPath - Σχετικό path ως προς το storagePath
 */
Storage.delete = async function(targetPath) {
    const absolutePath = path.resolve(Storage.storagePath, targetPath);
    assertInStorage(absolutePath);

    await fs.rm(absolutePath, { recursive: true });
};

/**
 * Αποθηκεύει ένα αρχείο στο storage. Επιστρέφει true αν η αποθήκευση ολοκληρώθηκε επιτυχώς.
 * @param {string} destinationPath - Σχετικό path προορισμού ως προς το storagePath
 * @param {object} file - Αντικείμενο αρχείου (π.χ. από multer)
 * @returns {boolean} Αν η αποθήκευση ολοκληρώθηκε επιτυχώς
 */
Storage.store = async function(destinationPath, file) {
    const fileName = path.basename(file?.originalname ?? '');
    if (!fileName) {
        throw new Error('Δεν βρέθηκε όνομα αρχείου για αποθήκευση');
    }

    const targetDirectory = path.resolve(Storage.storagePath, destinationPath);
    assertInStorage(targetDirectory, true);

    // Έλεγχος ύπαρξης ή δημιουργία του φακέλου αν δεν υπάρχει
    await fs.mkdir(targetDirectory, { recursive: true });

    const sanitizedFileName = Storage.sanitizer.sanitize(fileName);
    const targetPath = path.join(targetDirectory, sanitizedFileName);
    assertInStorage(targetPath);

    try {
        await fs.access(targetPath, constants.F_OK);
        const error = new Error('Υπάρχει ήδη αρχείο με το ίδιο όνομα στον φάκελο');
        error.code = Storage.errorCodes.duplicateFile;
        // Χρήση στο router: if (error.code === Storage.errorCodes.duplicateFile) {/*κλπ*/}
        throw error;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }

    if (file?.buffer) {
        await fs.writeFile(targetPath, file.buffer);
        return true;
    }

    const sourcePath = file?.path;
    if (!sourcePath) {
        throw new Error('Δεν βρέθηκε προσωρινό αρχείο για αποθήκευση');
    }

    try {
        await fs.rename(sourcePath, targetPath);
    } catch (error) {
        if (error?.code !== 'EXDEV') {
            throw error;
        }

        await fs.copyFile(sourcePath, targetPath);
        await fs.unlink(sourcePath);
    }

    return true;
};

/**
 * Επιστρέφει τα περιεχόμενα ενός φακέλου ως αρχείο ZIP.
 * @param {string} folderPath - Σχετικό path ως προς το storagePath
 */
Storage.getFolderAsZip = async function(folderPath) {
    return true;
};




export default Storage;
