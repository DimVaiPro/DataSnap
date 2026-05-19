import { styleText } from 'node:util';


/*

Χρώματα: 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray', 'bgRed', 'bgGreen', κ.ά.
Στυλ: 'bold', 'italic', 'underline', 'inverse', 'strikethrough'


*/

const display = (message) => {
    if (typeof message === 'string') return message;
    try {
        return JSON.stringify(message, null, 2);
    } catch (e) {
        return String(message);
    }
}


const log = (message) => {
  console.log(display(message));
}
log.dev = (message='- - - here - - -') => {
    if (process.env.NODE_ENV.toLocaleLowerCase() == 'development') {
        console.debug(styleText(['bold', 'italic', 'blue'], `📘 ${display(message)}`));
    }
}
log.system = (message, icon=true) =>{
    const prefix = icon ? '☑️  ' : '';
    console.log(styleText(['magenta','bold'], `${prefix}${display(message)}`));
}
log.info = (message, icon=true) => {
    const prefix = icon ? 'ℹ️  ' : '';
    console.log(styleText('blue', `${prefix}${display(message)}`));
}
log.error = (message, icon=true) => {
    const prefix = icon ? '🔴 ' : '';
    console.error(styleText(['red', 'bold'], `${prefix}${display(message)}`));
}
log.warn = (message, icon=true) => {
    const prefix = icon ? '⚠️  ' : '';
    console.warn(styleText('yellow', `${prefix}${display(message)}`));
}
log.success = (message, icon=true) => {
    const prefix = icon ? '✅ ' : '';
    console.log(styleText('green', `${prefix}${display(message)}`));
}


// Test those Examples:
// log('This is a simple log message');
// log.dev('This is a development message');
// log.dev();
// log.system('Server is running...');
// log.info('This is an info message');
// log.error("This is an error! Check it out!");
// log.error("This is an error! Check it out!", false);
// log.warn('This is a warning message');
// log.warn('This is a warning message', false);
// log.success('This is a success message');

export default log;