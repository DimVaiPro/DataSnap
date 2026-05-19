import { DataTypes } from 'sequelize';
import { db } from '../config/database.js';

/**
 * Model για ένα backup job βάσης δεδομένων
 */
const DatabaseJob = db.define('DatabaseJob', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isValidName(value) {
                if (!/^[\p{Ll}\d_-]+$/u.test(value)) {
                    throw new Error('Το όνομα επιτρέπεται να περιέχει μόνο πεζά γράμματα, αριθμούς, παύλες και κάτω παύλες');
                }
            },
        },
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    dialect: {
        type: DataTypes.ENUM('mysql', 'postgres'),
        allowNull: false,
    },
    host: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    dbName: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    username: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    password: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    lastBackupAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    lastBackupSucceededAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    lastBackupStatus: {
        type: DataTypes.ENUM('success', 'failed'),
        allowNull: true,
    },
    lastBackupMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'database_jobs',
    timestamps: true,
    underscored: true,
    indexes: [],
});

export default DatabaseJob;
