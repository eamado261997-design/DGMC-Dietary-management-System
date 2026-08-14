const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/AdminReports.tsx', 'utf8');

file = file.replace(/\{\/\* Dedicated Executive Summary for Cafeteria Statistics \*\/\}cs \*\/\}/g, '{/* Dedicated Executive Summary for Cafeteria Statistics */}');
fs.writeFileSync('src/pages/admin/AdminReports.tsx', file);
