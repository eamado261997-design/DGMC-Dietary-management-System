const fs = require('fs');
let file = fs.readFileSync('src/pages/employee/EmployeeMeals.tsx', 'utf8');

file = file.replace(/import PrintableHeader from "\.\.\/\.\.\/components\/PrintableHeader\.js";\nimport PrintableHeader from "\.\.\/\.\.\/components\/PrintableHeader\.js";/g, 'import PrintableHeader from "../../components/PrintableHeader.js";');
fs.writeFileSync('src/pages/employee/EmployeeMeals.tsx', file);
