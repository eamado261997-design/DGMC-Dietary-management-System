const fs = require('fs');

let file = fs.readFileSync('src/pages/admin/DietaryDashboard.tsx', 'utf8');

// Replace Tooltip in AreaChart (line 1485)
file = file.replace(/<Tooltip \s*contentStyle={{[^}]*}}\s*\/>/g, '<Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />');

// Specifically for the currency ones
file = file.replace(/<Tooltip \s*formatter=\{[^}]*\}\s*contentStyle={{[^}]*}}\s*\/>/g, '<Tooltip content={<CustomTooltip currency />} cursor={{ fill: "transparent" }} />');

// Now let's handle the overflow-x-auto for the containers
file = file.replace(/<div className="h-72 w-full pt-2">/g, '<div className="w-full overflow-x-auto"><div className="h-72 w-full min-w-[600px] pt-2">');
file = file.replace(/<div className="h-72 w-full pt-4">/g, '<div className="w-full overflow-x-auto"><div className="h-72 w-full min-w-[600px] pt-4">');
file = file.replace(/<div className="h-\[400px\] w-full pt-4">/g, '<div className="w-full overflow-x-auto"><div className="h-[400px] w-full min-w-[600px] pt-4">');
file = file.replace(/<div className="h-\[350px\] w-full pt-4">/g, '<div className="w-full overflow-x-auto"><div className="h-[350px] w-full min-w-[700px] pt-4">');
file = file.replace(/<div className="h-\[450px\] w-full pt-4">/g, '<div className="w-full overflow-x-auto"><div className="h-[450px] w-full min-w-[700px] pt-4">');

// Don't forget to close the overflow-x-auto div!
// We'll just rely on ResponsiveContainer to have minWidth={...} instead. That's safer and less regex prone.
