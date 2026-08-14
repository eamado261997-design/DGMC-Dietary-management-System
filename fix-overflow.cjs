const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/DietaryDashboard.tsx', 'utf8');

file = file.replace(/<div className="h-72 w-full pt-2">/g, '<div className="h-72 w-full pt-2 overflow-x-auto overflow-y-hidden scrollbar-thin">');
file = file.replace(/<div className="h-72 w-full pt-4">/g, '<div className="h-72 w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">');
file = file.replace(/<div className="h-\[400px\] w-full pt-4">/g, '<div className="h-[400px] w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">');
file = file.replace(/<div className="h-\[350px\] w-full pt-4">/g, '<div className="h-[350px] w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">');
file = file.replace(/<div className="h-\[450px\] w-full pt-4">/g, '<div className="h-[450px] w-full pt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">');

fs.writeFileSync('src/pages/admin/DietaryDashboard.tsx', file);
