import mysql from 'mysql2/promise';
import log from '../../lib/logger.js';

const INSERT_BATCH_SIZE = 5000;

function escapeMysqlString(str) {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\0/g, '\\0');
}

// Μετατρέπει JS τιμή σε MySQL SQL literal
function mysqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
    if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
    if (typeof value === 'object') return `'${escapeMysqlString(JSON.stringify(value))}'`;
    return `'${escapeMysqlString(String(value))}'`;
}

// Δημιουργεί connection options για την target βάση
function connectionOptions(job) {
    return {
        host: job.host,
        port: job.port,
        database: job.dbName,
        user: job.username,
        password: job.password,
        connectTimeout: 10000,
    };
}

// Κατηγοριοποιεί ένα σφάλμα σύνδεσης MySQL
function categorizeConnectionError(error) {
    const message = error.message ?? '';
    const code = error.code ?? '';
    if (code === 'ER_ACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR') {
        return { success: false, errorType: 'authentication', message };
    }
    return { success: false, errorType: 'connectivity', message };
}

/**
 * Ελέγχει αν μπορεί να γίνει σύνδεση στη βάση
 */
export async function checkConnectivity(job) {
    let connection;
    try {
        connection = await mysql.createConnection(connectionOptions(job));
        return { success: true };
    } catch (error) {
        return categorizeConnectionError(error);
    } finally {
        connection?.end().catch(() => {});
    }
}

/**
 * Ελέγχει αν υπάρχουν δικαιώματα SELECT
 */
export async function checkReadAccess(job) {
    let connection;
    try {
        connection = await mysql.createConnection(connectionOptions(job));
    } catch (error) {
        return categorizeConnectionError(error);
    }
    try {
        await connection.execute('SELECT 1');
        return { success: true };
    } catch (error) {
        return { success: false, errorType: 'permissions', message: error.message };
    } finally {
        connection?.end().catch(() => {});
    }
}

/**
 * Δημιουργεί SQL dump της MySQL βάσης (DBeaver-compatible)
 * @param {object} job - Αντικείμενο με τα στοιχεία σύνδεσης
 * @returns {string} Το περιεχόμενο του SQL dump
 */
export async function createDump(job) {
    const connection = await mysql.createConnection(connectionOptions(job));

    try {
        const lines = [];
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

        lines.push(`-- DataSnap Backup`);
        lines.push(`-- Database: ${job.dbName}`);
        lines.push(`-- Host: ${job.host}:${job.port}`);
        lines.push(`-- Dialect: MySQL`);
        lines.push(`-- Generated: ${now}`);
        lines.push('');
        lines.push('SET FOREIGN_KEY_CHECKS=0;');
        lines.push(`SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';`);
        lines.push('SET NAMES utf8mb4;');
        lines.push('');

        const [tables] = await connection.execute('SHOW TABLES');
        const tableNames = tables.map(r => Object.values(r)[0]);

        for (const table of tableNames) {
            // DDL μέσω SHOW CREATE TABLE (ακριβώς όπως το mysqldump)
            const [createResult] = await connection.execute(`SHOW CREATE TABLE \`${table}\``);
            const createDDL = createResult[0]['Create Table'];

            lines.push(`-- Table: ${table}`);
            lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
            lines.push(createDDL + ';');
            lines.push('');

            // Data
            const [rows, fields] = await connection.execute(`SELECT * FROM \`${table}\``);
            if (!rows.length) continue;

            const columns = fields.map(f => `\`${f.name}\``).join(', ');
            lines.push(`-- Data for table: ${table}`);

            for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
                const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
                const values = batch.map(row =>
                    `(${fields.map(f => mysqlValue(row[f.name])).join(', ')})`
                ).join(',\n');
                lines.push(`INSERT INTO \`${table}\` (${columns}) VALUES`);
                lines.push(values + ';');
            }
            lines.push('');
        }

        lines.push('SET FOREIGN_KEY_CHECKS=1;');
        return lines.join('\n');
    } finally {
        connection.end().catch(() => {});
    }
}
