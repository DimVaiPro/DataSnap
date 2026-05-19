import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 12;
const authTagLength = 16;
const encryptedPrefix = 'enc:v1';

function getEncryptionKey() {
    const secret = process.env.ENCRYPTIONKEY;

    if (!secret) {
        throw new Error('Δεν έχει οριστεί το ENCRYPTIONKEY.');
    }

    return crypto.createHash('sha256').update(secret).digest();
}

function isEncrypted(value) {
    return String(value).startsWith(`${encryptedPrefix}:`);
}

/**
 * Κρυπτογραφεί ένα string ώστε να αποθηκευτεί στη βάση.
 * @param {string} value - Η τιμή προς κρυπτογράφηση
 * @returns {string} Η κρυπτογραφημένη τιμή
 */
export function encrypt(value) {
    if (!value) {
        return value ?? '';
    }

    if (isEncrypted(value)) {
        return value;
    }

    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv, {
        authTagLength,
    });

    const encrypted = Buffer.concat([
        cipher.update(String(value), 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        encryptedPrefix,
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted.toString('hex'),
    ].join(':');
}

/**
 * Αποκρυπτογραφεί ένα string από τη βάση. Αν η τιμή είναι legacy plain text, επιστρέφεται ως έχει.
 * @param {string} value - Η αποθηκευμένη τιμή
 * @returns {string} Η αποκρυπτογραφημένη τιμή
 */
export function decrypt(value) {
    if (!value) {
        return value ?? '';
    }

    if (!isEncrypted(value)) {
        return value;
    }

    const [prefix, version, ivHex, authTagHex, encryptedHex, ...rest] = String(value).split(':');

    if (`${prefix}:${version}` !== encryptedPrefix || !ivHex || !authTagHex || !encryptedHex || rest.length) {
        throw new Error('Μη έγκυρη μορφή κρυπτογραφημένου password.');
    }

    const decipher = crypto.createDecipheriv(
        algorithm,
        getEncryptionKey(),
        Buffer.from(ivHex, 'hex'),
        { authTagLength },
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}