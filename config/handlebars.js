import { create as HandlebarsCreator } from 'express-handlebars';
// import { labels } from '../lib/labels.js';

const handlebarsConfig = {
    extname: '.hbs',    // extension for layouts (not views)
    layoutsDir: 'views/layouts',
    defaultLayout: 'main',
    helpers: 'views',
    partialsDir: 'views/partials',
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    },
    helpers: {
        /* example: {{#if (eq user.attend 'live')}} Δια ζώσης {{else if (eq user.attend 'internet')}} Διαδικτυακά {{/if}} */  
        eq: (a, b) => a == b, 
        and: (...args) => args.slice(0, -1).every(Boolean), // Handlebars 'and' helper
        /* Check if array includes a value: {{#if (includes array 'value')}} */
        includes: (array, value) => Array.isArray(array) && array.includes(value),
        /* example: {{check variable.length variable 'empty'}} */
        check: (condition, valueIfTrue, valueIfFalse) => condition ? valueIfTrue : valueIfFalse,
        /* example: {{or a b c}}, it needs c (Handlebars doesn't pass undefined). Use '' as third argument. */
        or: (a, b, c) => a ?? b ?? c, 
        /** example: {{deepLookup obj 'key1' 'key2' 'key3'}} or {{deepLookup submission.data @index 'students'}}. Το handlebars έχει ήδη την {{lookup object 'key'}} */
        deepLookup: (obj, ...keys) => {
            // Remove the Handlebars context object (last argument)
            const actualKeys = keys.slice(0, -1);
            return actualKeys.reduce((current, key) => current?.[key], obj) ?? '';
        },
        /* example: <script> let obj = {{{objectify obj}}}; </script> */      
        objectify: (object) => JSON.stringify(object),  
        inflect: (number, singular, plural) => number + ' ' + (number==1 ? singular : plural),
        /* example: {{#each (array 1 2 3)}} */
        array: (...items) => items.slice(0, -1), // -1: Remove the Handlebars context object
        /* example {{join 'a' 'b' 'c'}} => a, b, c */
        join: (...items) => items.slice(0, -1).filter(Boolean).join(', '),
        euro: (price) => new Intl.NumberFormat('el-GR', {style: 'currency', currency: 'EUR'}).format(price),
        time: (date) => {
            if (!date) return '';
            try {
                const dateObj = date instanceof Date ? date : new Date(date);
                if (isNaN(dateObj.getTime())) return '';
                return new Intl.DateTimeFormat('el-GR', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hourCycle: 'h23', 
                    timeZone: 'Europe/Athens' 
                }).format(dateObj);
            } catch (error) {
                console.error('Time formatting error:', error, 'for date:', date);
                return '';
            }
        },
        date: (date) => {
            if (!date) return '';
            try {
                const dateObj = date instanceof Date ? date : new Date(date);
                if (isNaN(dateObj.getTime())) return '';
                return new Intl.DateTimeFormat('el-GR', { 
                    day: 'numeric', 
                    month: 'numeric', 
                    year: 'numeric',
                    timeZone: 'Europe/Athens' 
                }).format(dateObj);
            } catch (error) {
                console.error('Date formatting error:', error, 'for date:', date);
                return '';
            }
        },
        datetime: (date) => {
            if (!date) return '';
            try {
                const dateObj = date instanceof Date ? date : new Date(date);
                if (isNaN(dateObj.getTime())) return '';
                return new Intl.DateTimeFormat('el-GR', { 
                    day: 'numeric', 
                    month: 'numeric', 
                    year: 'numeric', 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hourCycle: 'h23',
                    timeZone: 'Europe/Athens' 
                }).format(dateObj);
            } catch (error) {
                console.error('DateTime formatting error:', error, 'for date:', date);
                return '';
            }
        },
        dateInput: (date) => {
            if (!date) return '';
            try {
                const dateObj = date instanceof Date ? date : new Date(date);
                if (isNaN(dateObj.getTime())) return '';
                // Μετατροπή σε YYYY-MM-DD format για HTML date input
                return dateObj.toISOString().split('T')[0];
            } catch (error) {
                console.error('DateInput formatting error:', error, 'for date:', date);
                return '';
            }
        },
        /** example: {{label 'status' 'pending'}} => Σε εκκρεμότητα */
        label: function(category, value) {
            if (typeof labels[category] === 'function') {
                return labels[category](value) ?? '';
            }
            return labels[category]?.[value] ?? '';
        },
        /** Επιστρέφει array [{value, name}] για οποιαδήποτε κατηγορία labels (εκτός από functions), χρήσιμο για {{#each}} στα views.
         * example: {{#each (labelEntries 'leaveType')}} */
        labelEntries: (category) => {
            const map = labels[category];
            if (!map || typeof map === 'function') return [];
            return Object.entries(map).map(([value, name]) => ({ value, name }));
        },
    }
};

let handlebarsEngine = HandlebarsCreator(handlebarsConfig).engine;

export default handlebarsEngine;
