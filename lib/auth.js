import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ms from 'ms';
import { promisify } from 'util';
import log from '../lib/logger.js';
// import Models from '../models/models.js';
// import { Op } from 'sequelize';


/////////////////////////////         CONFIGURATION         /////////////////////////////

// Σημείωση. Επειδή το Access Token χρησιμοποιεί δευτερόλεπτα, η μονάδα μέτρησης χρόνου σε αυτό το αρχείο να είναι τα δευτερόλεπτα. 

/** Το μυστικό string για την δημιουργία και επαλήθευση του Access Token */
const jwtsecret = process.env.JWTSECRET;
/** Το όνομα του cookie που περιέχει το Access Token */
const cookieName = process.env.TOKENCOOKIENAME;
/** Tο path στο οποίο στέλνουμε τον μη πιστοποιημένο χρήστη ώστε να βάλει email & password. */
const loginpath = "/login";
/** Δεν εφαρμόζεται. Τα paths τα οποία δεν ΠΡΟαπαιτούν authentication για την χρήση τους από το χρήστη. Τα περιεχόμενα του φάκελου public δεν περιλαμβάνονται */
const freepaths = ["/login", "/autologin", "/userlogin", "/status", "/404", ];

/**
 * Επιστρέφει true αν το path ταιριάζει με κάποιο pattern του freepaths (υποστηρίζει * στο τέλος)
 */
function isFreePath(path) {
    return freepaths.some(pattern => {
        if (pattern.endsWith('/*')) {
            const base = pattern.slice(0, -1); // αφαιρεί το *
            return path.startsWith(base);
        }
        return path === pattern;
    });
}

/** Το audience του Access Token. Εδω, χρησιμοποιείται και ως aud και ως iss */
let aud, iss;
aud = iss = process.env.LISTENINGDOMAIN || "localhost";
/** H διάρκεια του Token σε string */
const tokenExpirationTime = process.env.TOKENEXPIRATIONTIME;
/** H διάρκεια του Magic Link Token σε string */
const linkExpirationTime = process.env.LINKEXPIRATIONTIME;
/** Το χρονικό διάστημα πριν τη λήξη του token κατά το οποίο το token πρέπει να ανανεωθεί, σε δευτερόλεπτα */
const tokenRefreshThreshold = ms(process.env.TOKENREFRESHTHRESHOLD)/1000;
/** Τα options του Access Token cookie */
const cookieOptions = { 
    httpOnly: true, 
    secure: (process.env.TOKENHTTPS=="false")?false:true, 
    sameSite: 'lax',    // Αν βάλω 'strict', δεν δουλεύουν τα cookies από link σε email.
    maxAge: ms(tokenExpirationTime),
};

const scryptAsync = promisify(crypto.scrypt);
const passwordKeyLength = 64;



/////////////////////////////    HASHING AND VALIDATING PASSWORD    /////////////////////////////

/**
 * Κρυπτογραφεί ένα password με scrypt και τυχαίο salt
 * @param {string} password - Το password προς κρυπτογράφηση
 * @returns {Promise<string>} Το hashed password με salt (μορφή: scrypt:salt:hash)
 */
const hashPassword = async (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt, passwordKeyLength)).toString('hex');
    return `scrypt:${salt}:${hash}`;
};

/**
 * Ελέγχει αν το password ταιριάζει με το hashedPassword (μορφή: scrypt:salt:hash). Επιστρέφει true ή false.
 * @param {string} password - Το password προς έλεγχο
 * @param {string} hashedPassword - Το αποθηκευμένο hash με salt
 * @returns {Promise<boolean>}
 */
let validatePassword = async (password, hashedPassword) => {
    const [algorithm, salt, storedHash, ...rest] = hashedPassword.split(':');
    if (algorithm !== 'scrypt' || !salt || !storedHash || rest.length) return false;

    const storedBuffer = Buffer.from(storedHash, 'hex');
    const hashToCompare = await scryptAsync(password, salt, passwordKeyLength);
    if (storedBuffer.length !== hashToCompare.length) return false;
    return crypto.timingSafeEqual(hashToCompare, storedBuffer);
};



/////////////////////////////    FUNCTIONS & MIDDLEWARE    /////////////////////////////


/** Ανακτά τον χρήστη από τη βάση δεδομένων με βάση το email */
let envUser = async (email) => {
    return (email===process.env.USEREMAIL) ? { 
        email: process.env.USEREMAIL, 
        password: process.env.PASSWORD, 
        username: process.env.USER, 
        name: process.env.USER,
        id: 0,
    } : null;
};


/** Ελέγχει το email και το password του χρήστη σύμφωνα με αυτά που υπάρχουν στη Βάση και επιστρέφει το χρήστη */
let getUserFromDatabaseByCredentials = async (email, password) => {
    let user = await envUser(email);
    if (!user) return false;
    // log.dev({user});

    let passwordMatch = (password == user.password);
    if (passwordMatch) {return user}
    else {return false}

};

/** Δημιουργεί το Access Token του χρήστη */
let createAccessToken = (user, forMagicLink=false) => {
    return jwt.sign({
        iss: iss,      // the URL of the AUTH server (https://auth.example.com/)
        sub: user.id,   // The user id
        aud: aud,       // The URL of the API server (https://api.example.com/)
        username: user.username,
        email: user?.email??null,
        name: user.name,
    }, jwtsecret, {expiresIn: forMagicLink ? linkExpirationTime : tokenExpirationTime});
};

/** Ανανεώνει το Access Token του χρήστη, μόνο αν ο χρήστης υπάρχει ακόμα και είναι ενεργός */
let renewAccessToken = async (oldDecodedToken) => {
    let user = await envUser(oldDecodedToken.email);
    if (!user) return false;

    let { exp, iat, ...newToken } = oldDecodedToken;     // το newToken είναι το oldDecodedToken χωρίς τα exp and iat
    return jwt.sign(newToken, jwtsecret, {expiresIn: tokenExpirationTime});
};



/** Ελέγχει το email και το password που πληκτρολόγησε ο χρήστης στη φόρμα και του στέλει το Access Token σε Cookie */
let validateCredentials = async (req, res, next) => {
    let body = req.body;
    let user = await getUserFromDatabaseByCredentials(body.email,body.password);
    if (user) {
        /** To JWT Token που θα σταλεί στον χρήστη */
        let token = createAccessToken(user);
        res.cookie(cookieName, token, cookieOptions);
        req.user = user;
    } else {
        log.warn(`Wrong email/password: ${body.email} ${body.password} `);
    }
    next();
};




/** 
 * Middleware το οποίο ελέγχει ότι ο χρήστης είναι έγκυρος με βάση το Access Token που έστειλε. 
 * Δημουργεί τα req.user (για τα middleware) και res.locals.user (για το view).
 * Αν πρόκειται να λήξει, το ανανεώνει. 
 * Αν δεν είναι έγκυρος, τον στέλνει στο loginpath. Εξαιρούνται free paths.
 */
let validateUser = (req, res, next) => {
    // log.dev(`Request: ${req.method} ${req.path} `);
    // log.dev(req.cookies.token);

    /** Ελέγχει αν το path είναι ελεύθερο και αν ναι, αφήνει το χρήστη να συνεχίσει, αλλιώς τον οδηγεί στο loginpath */
    let handleLoggedOffUser = () => {
        if ( isFreePath(req.path) ) {
            next();
            return;
        } else {    // Αν όχι, στέλνουμε τον χρήστη στο login
            res.redirect(loginpath);
        }
    }

    /** Το Access Token του χρήστη */
    let token = req.cookies?.[cookieName];
    // log.dev(`Access Token: ${token}`);
    if (token) {         // Επαλήθευση του Access Token (σε κάθε path)
        jwt.verify(
            token, 
            jwtsecret, 
            {audience: aud, issuer: iss}, 
            async (failure, decodedToken) => {
                if ( failure ) {    // Λάθος token ή ληγμένο token (ο χρήστης δεν είναι logged-in)
                    log.info(`Invalid or expired token: ${token}`);
                    log.info(failure);
                    res.locals.error = 'Η σύνδεσή σας έχει λήξει. Παρακαλώ συνδεθείτε ξανά.';
                    handleLoggedOffUser();
                }
                else {  // Το access token είναι ΟΚ και ο χρήστης είναι logged-in.

                    // Αν το token λήγει, να ανανεωθεί.
                    /** O χρόνος που απομένει πριν τη λήξη του token σε δευτερόλεπτα */
                    const timeLeft = decodedToken.exp - Math.floor(Date.now()/1000);
                    if (timeLeft < tokenRefreshThreshold) {
                        let renewedToken = await renewAccessToken(decodedToken);
                        if (!renewedToken) {
                            res.locals.error = 'Ο λογαριασμός σας δεν είναι πλέον διαθέσιμος. Παρακαλώ συνδεθείτε ξανά.';
                            handleLoggedOffUser();
                            return;
                        }
                        res.cookie(cookieName, renewedToken, cookieOptions);
                    }

                    // Αποθήκευση του χρήστη στο req.user και res.locals.user
                    req.user = decodedToken;            // για middleware
                    res.locals.user = decodedToken;     // για view
                    // log.dev(req.user);
                    next();
                }
            }
        );
    }
    else {  // Αν δεν υπάρχει Access Token
        // log.dev('No token provided');
        res.locals.error = 'Θα πρέπει να συνδεθείτε για να συνεχίσετε στην εφαρμογή.';
        handleLoggedOffUser();
    }
};




export { validateCredentials, validateUser, hashPassword, createAccessToken };
