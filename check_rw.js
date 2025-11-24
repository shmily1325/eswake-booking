import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const rw = require('react-window');
console.log('Exports:', Object.keys(rw));
