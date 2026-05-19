////////////////////  INITIALIZATION  ////////////////////


console.log('Initializing server...');

import express from 'express';
import handlebarsEngine from './config/handlebars.js';
import cookieParser from 'cookie-parser';
import log from './lib/logger.js';
// import Security from "./config/security.js";

const server = express();
// server.set('trust proxy', 1);

server.engine('hbs', handlebarsEngine);
server.set('view engine', 'hbs');
server.set('views', 'views');

server.use(express.static('public'));
server.use(express.urlencoded({ extended: true }));
server.use(express.json());
server.use(cookieParser());
// server.use(Security);


////////////////////   MIDDLEWARE AND FUNCTIONS   ////////////////////

import { presentTime } from './lib/utils.js';
import { validateUser } from './lib/auth.js';

import { db, databaseConnectionTest } from './config/database.js';
import Models from './models/models.js';
import Storage from './lib/storage.js';




/////////////////        ΕΛΕΥΘΕΡΑ ROUTES      /////////////////

// server.get('/', (req, res) => {
//     res.send('Welcome to the DataSnap server!');
// });

server.get(['/status', '/health'], async (req, res) => {
    let statusData = {
        webServer: 'OK',
        storage: 'FAILED',
        database: 'FAILED',
        // smtp: 'NOT TESTED'
    };
    let overallStatus = 500;
    
    try {
        await Storage.check(false);
        statusData.storage = 'OK';
    } catch (error) {
        log.error(`Health check - Storage error: ${error}`);
    }

    try {
        await db.authenticate();
        statusData.database = 'OK';
    } catch (error) {
        log.error(`Health check - Database error: ${error}`);
    }

    if (statusData.storage === 'OK' && statusData.database === 'OK') {
        overallStatus = 200;
    }
    
    const htmlTable = `
    <table style="border-collapse: collapse;">
        <style>td { border: 1px solid black; padding: 5px; }</style>
        <tr><td>Web Server</td><td>${statusData.webServer}</td></tr>
        <tr><td>Storage</td><td>${statusData.storage}</td></tr>
        <tr><td>Database</td><td>${statusData.database}</td></tr>
    </table>`;
    
    res.status(overallStatus).send(htmlTable);
});


//* Login routes (ελεύθερα)
import loginRouter from './routes/login.js';
server.use(loginRouter);



///////////////// ROUTES ΜΟΝΟ ΓΙΑ ΠΙΣΤΟΠΟΙΗΜΕΝΟΥΣ ΧΡΗΣΤΕΣ /////////////////

server.use(validateUser);

import databasesRouter from './routes/databases.js';
import backupsRouter from './routes/backups.js';
server.use(databasesRouter);
server.use(backupsRouter);

server.get('/', (req, res) => res.redirect('/dashboard'));




///////////////////////////////////         THE SERVER         /////////////////////////////////////

async function startServer(){
    log.info('Node.js version: ' + process.version);
    await databaseConnectionTest(db);
    await Storage.check();
    await Models.syncModels();
    let port = process.env.PORT??80;
    let listeningURL = process.env.LISTENINGURL??'http://localhost';
    server.listen(port, () => {
        log.system(`Express server started at ${presentTime()} | Listening at ${listeningURL}.`);
    });
}
startServer();



