import { Sequelize } from 'sequelize';
import log from '../lib/logger.js';



/** The database connection using Sequelize */
let db = new Sequelize(
    process.env.DATABASENAME, 
    process.env.DATABASEUSERNAME, 
    process.env.DATABASEPASSWORD, 
    {
        host: process.env.DATABASEHOST,
        port: process.env.DATABASEPORT,
        dialect: process.env.DATABASEDIALECT, // 'mysql', 'sqlite', 'postgres', 'mssql'
        timezone: "Europe/Athens",                         // greek time, for writing to database   
        // query: { raw: true },       // returns queries as simple JSON objects, but can't be modified with getters or use .update()
        logging: false,         // does not console log things...
        pool: {
            max: 3,
            min: 0,
            acquire: 30000,
            idle: 30000
          },
        retry: { max: 3 },
    }
);




/** Returns a promise - resolves if the database is succesfully connected */
let databaseConnectionTest = (DbConnection) => {
    return new Promise(async (resolve, reject) => {
        try{
            await DbConnection.authenticate();
            log.system(`Database connection to ${process.env.DATABASEHOST}\\${process.env.DATABASENAME} (${process.env.DATABASEDIALECT}) has been established successfully.`);
            resolve();
        } catch (error) {
            log.error(`Unable to connect to the database: ${error}`);
            reject();
        }
    });
};

export { db , databaseConnectionTest } ;