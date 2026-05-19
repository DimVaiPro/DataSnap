import { Router } from 'express';
const router = Router();


import { validateCredentials } from '../lib/auth.js';
import log from '../lib/logger.js';

const tokenCookieName = process.env.TOKENCOOKIENAME;


router.get('/login', (req, res) => {
    // Αν υπάρχει token στο URL (magic link), διαγράφουμε το παλιό cookie
    if (req.query[tokenCookieName]) {
        res.clearCookie(tokenCookieName);
    }
    res.render('login/login', { 
            layout: 'basic', 
            tokenCookieName,
            environment: process.env.NODE_ENV,
        });
});

router.post('/login', validateCredentials, (req, res) => {
    if (req.user) {
        res.redirect('/dashboard');
    } else {
        res.render('login/login', { layout: 'basic', error: "Τα στοιχεία σας δεν είναι σωστά. Παρακαλώ προσπαθήστε ξανά." });
    }
});


router.get('/autologin', 
    (req, res, next) => {
        let email = req.query.email;
        let password = req.query.pass;
        if (!email || !password) {
            res.redirect('/login');
            return;  // όχι next()
        } else {
            req.body ??= {};       // so req.body can't be undefined
            req.body.email = email;
            req.body.password = password;
        }
        next();
    },
    validateCredentials,
    (req, res) => {
        if (req.user){
            res.redirect('/dashboard');
        }
        else {
            res.render("login/login", {layout: 'basic', error: "Τα στοιχεία σας δεν είναι σωστά. Παρακαλώ προσπαθήστε ξανά."});
        }
    }
);

router.get('/logout', (req, res) => {
    // delete cookie
    res.clearCookie(tokenCookieName);
    res.redirect('/login');
});


export default router;