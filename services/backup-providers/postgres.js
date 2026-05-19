import { Client } from 'pg';
import log from '../../lib/logger.js';

const INSERT_BATCH_SIZE = 5000;

// PostgreSQL OIDs για αριθμητικούς τύπους
const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700]);
const BOOLEAN_OID = 16;
const BYTEA_OID = 17;
const JSON_OIDS = new Set([114, 3802]);
const DATE_OIDS = new Set([1082, 1083, 1114, 1184, 1266]);

function escapePgString(str) {
    return String(str).replace(/\\/g, '\\').replace(/'/g, "''");
}

// Μετατρέπει JS τιμή σε PostgreSQL SQL literal με βάση τον OID τύπου
function pgValue(value, oid) {
    if (value === null || value === undefined) return 'NULL';
    if (oid === BOOLEAN_OID) return value ? 'TRUE' : 'FALSE';
    if (NUMERIC_OIDS.has(oid)) return String(value);
    if (oid === BYTEA_OID) {
        if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`;
        return 'NULL';
    }
    if (JSON_OIDS.has(oid)) {
        const json = typeof value === 'string' ? value : JSON.stringify(value);
        return `'${escapePgString(json)}'`;
    }
    if (DATE_OIDS.has(oid)) {
        if (value instanceof Date) return `'${value.toISOString()}'`;
        return `'${escapePgString(String(value))}'`;
    }
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString()}'`;
    if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`;
    if (typeof value === 'object') return `'${escapePgString(JSON.stringify(value))}'`;
    return `'${escapePgString(String(value))}'`;
}

// Δημιουργεί connection options για την target βάση
function connectionOptions(job) {
    return {
        host: job.host,
        port: job.port,
        database: job.dbName,
        user: job.username,
        password: job.password,
        connectionTimeoutMillis: 10000,
    };
}

// Κατηγοριοποιεί ένα σφάλμα σύνδεσης PostgreSQL
function categorizeConnectionError(error) {
    const message = error.message ?? '';
    const code = error.code ?? '';
    if (code === '28P01' || code === '28000' || message.includes('password authentication failed')) {
        return { success: false, errorType: 'authentication', message };
    }
    return { success: false, errorType: 'connectivity', message };
}

/**
 * Ελέγχει αν μπορεί να γίνει σύνδεση στη βάση
 */
export async function checkConnectivity(job) {
    const client = new Client(connectionOptions(job));
    try {
        await client.connect();
        return { success: true };
    } catch (error) {
        return categorizeConnectionError(error);
    } finally {
        client.end().catch(() => {});
    }
}

/**
 * Ελέγχει αν υπάρχουν δικαιώματα SELECT
 */
export async function checkReadAccess(job) {
    const client = new Client(connectionOptions(job));
    try {
        await client.connect();
    } catch (error) {
        return categorizeConnectionError(error);
    }
    try {
        await client.query('SELECT 1 FROM information_schema.tables LIMIT 1');
        return { success: true };
    } catch (error) {
        return { success: false, errorType: 'permissions', message: error.message };
    } finally {
        client.end().catch(() => {});
    }
}

/**
 * Δημιουργεί SQL dump της PostgreSQL βάσης (DBeaver-compatible)
 * @param {object} job - Αντικείμενο με τα στοιχεία σύνδεσης
 * @returns {string} Το περιεχόμενο του SQL dump
 */
export async function createDump(job) {
    const client = new Client(connectionOptions(job));
    await client.connect();

    try {
        const lines = [];
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

        lines.push(`-- DataSnap Backup`);
        lines.push(`-- Database: ${job.dbName}`);
        lines.push(`-- Host: ${job.host}:${job.port}`);
        lines.push(`-- Dialect: PostgreSQL`);
        lines.push(`-- Generated: ${now}`);
        lines.push('');
        lines.push(`SET client_encoding = 'UTF8';`);
        lines.push('SET standard_conforming_strings = on;');
        lines.push('');

        // Λήψη πινάκων
        const tablesResult = await client.query(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
        );
        const tables = tablesResult.rows.map(r => r.tablename);

        // CREATE TABLE για κάθε πίνακα
        for (const table of tables) {
            const colsResult = await client.query(`
                SELECT
                    a.attname AS column_name,
                    format_type(a.atttypid, a.atttypmod) AS data_type,
                    a.attnotnull AS not_null,
                    pg_get_expr(d.adbin, d.adrelid) AS default_value
                FROM pg_attribute a
                LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
                WHERE a.attrelid = $1::regclass
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                ORDER BY a.attnum
            `, [`public.${table}`]);

            const pkResult = await client.query(`
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                  AND tc.table_name = $1
                  AND tc.constraint_type = 'PRIMARY KEY'
                ORDER BY kcu.ordinal_position
            `, [table]);

            const columnDefs = colsResult.rows.map(col => {
                let def = `    "${col.column_name}" ${col.data_type}`;
                if (col.not_null) def += ' NOT NULL';
                if (col.default_value) def += ` DEFAULT ${col.default_value}`;
                return def;
            });

            if (pkResult.rows.length > 0) {
                const pkCols = pkResult.rows.map(r => `"${r.column_name}"`).join(', ');
                columnDefs.push(`    CONSTRAINT "${table}_pkey" PRIMARY KEY (${pkCols})`);
            }

            lines.push(`-- Table: public.${table}`);
            lines.push(`CREATE TABLE IF NOT EXISTS public."${table}" (`);
            lines.push(columnDefs.join(',\n'));
            lines.push(');');
            lines.push('');
        }

        // INSERT data για κάθε πίνακα
        for (const table of tables) {
            const dataResult = await client.query(`SELECT * FROM public."${table}"`);
            if (!dataResult.rows.length) continue;

            const columns = dataResult.fields.map(f => `"${f.name}"`).join(', ');
            lines.push(`-- Data for table: public.${table}`);

            for (let i = 0; i < dataResult.rows.length; i += INSERT_BATCH_SIZE) {
                const batch = dataResult.rows.slice(i, i + INSERT_BATCH_SIZE);
                const values = batch.map(row =>
                    `(${dataResult.fields.map(f => pgValue(row[f.name], f.dataTypeID)).join(', ')})`
                ).join(',\n');
                lines.push(`INSERT INTO public."${table}" (${columns}) VALUES`);
                lines.push(values + ';');
            }
            lines.push('');
        }

        // Sequences
        const seqResult = await client.query(`
            SELECT sequencename, last_value
            FROM pg_sequences
            WHERE schemaname = 'public' AND last_value IS NOT NULL
        `);
        if (seqResult.rows.length) {
            lines.push('-- Sequences');
            for (const seq of seqResult.rows) {
                lines.push(`SELECT setval('public."${seq.sequencename}"', ${seq.last_value}, true);`);
            }
            lines.push('');
        }

        // Indexes (εκτός primary/unique constraints)
        const indexResult = await client.query(`
            SELECT tablename, indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname NOT IN (
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_schema = 'public'
              )
            ORDER BY tablename, indexname
        `);
        if (indexResult.rows.length) {
            lines.push('-- Indexes');
            for (const idx of indexResult.rows) {
                lines.push(`${idx.indexdef};`);
            }
            lines.push('');
        }

        // Unique constraints
        for (const table of tables) {
            const uniqResult = await client.query(`
                SELECT tc.constraint_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                  AND tc.table_name = $1
                  AND tc.constraint_type = 'UNIQUE'
                ORDER BY tc.constraint_name, kcu.ordinal_position
            `, [table]);

            const constraints = {};
            for (const row of uniqResult.rows) {
                if (!constraints[row.constraint_name]) constraints[row.constraint_name] = [];
                constraints[row.constraint_name].push(row.column_name);
            }
            for (const [name, cols] of Object.entries(constraints)) {
                const colStr = cols.map(c => `"${c}"`).join(', ');
                lines.push(`ALTER TABLE IF EXISTS public."${table}" ADD CONSTRAINT "${name}" UNIQUE (${colStr});`);
            }
        }

        // Foreign keys (μετά τα data για να αποφύγουμε constraint violations κατά restore)
        lines.push('');
        lines.push('-- Foreign keys');
        for (const table of tables) {
            const fkResult = await client.query(`
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = $1
                ORDER BY tc.constraint_name, kcu.ordinal_position
            `, [table]);

            const fks = {};
            for (const row of fkResult.rows) {
                if (!fks[row.constraint_name]) {
                    fks[row.constraint_name] = { columns: [], foreignTable: row.foreign_table_name, foreignColumns: [] };
                }
                fks[row.constraint_name].columns.push(row.column_name);
                fks[row.constraint_name].foreignColumns.push(row.foreign_column_name);
            }
            for (const [name, fk] of Object.entries(fks)) {
                const cols = fk.columns.map(c => `"${c}"`).join(', ');
                const foreignCols = fk.foreignColumns.map(c => `"${c}"`).join(', ');
                lines.push(`ALTER TABLE IF EXISTS public."${table}" ADD CONSTRAINT "${name}" FOREIGN KEY (${cols}) REFERENCES public."${fk.foreignTable}" (${foreignCols});`);
            }
        }

        return lines.join('\n');
    } finally {
        client.end().catch(() => {});
    }
}
