const fs = require('fs');
let file = fs.readFileSync('src/pages/manager/ManagerSchedule.tsx', 'utf8');

file = file.replace(/const normalizedSchedules = \(schedList \|\| \[\]\)\.map/g, 'const normalizedSchedules = (Array.isArray(schedList) ? schedList : []).map');
file = file.replace(/setEmployees\(staffList\);/g, 'setEmployees(Array.isArray(staffList) ? staffList : []);');

fs.writeFileSync('src/pages/manager/ManagerSchedule.tsx', file);
