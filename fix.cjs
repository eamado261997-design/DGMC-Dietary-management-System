const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/DietaryDashboard.tsx', 'utf8');

// Replace standard Tooltip
file = file.replace(/<Tooltip \s*\n\s*contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}\s*\/>/g, '<Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />');

// Replace Tooltip with formatter
file = file.replace(/<Tooltip \s*\n\s*formatter={\(value: any, name: any\) => \[`₱\${parseFloat\(value \|\| 0\)\.toFixed\(2\)}`, name\]}\s*\n\s*contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}\s*\/>/g, '<Tooltip content={<CustomTooltip currency />} cursor={{ fill: "transparent" }} />');

// Add minWidth prop to ResponsiveContainer 
file = file.replace(/<ResponsiveContainer \n\s*width="100%" \n\s*height="100%"/g, '<ResponsiveContainer width="100%" height="100%" minWidth={600}');
file = file.replace(/<ResponsiveContainer width="100%" height="100%">/g, '<ResponsiveContainer width="100%" height="100%" minWidth={600}>');

// Ensure PieChart doesn't force a minimum width because it scales gracefully
// The easiest way is to revert PieChart specifically or manually:
// Let's just write back the file and see.

fs.writeFileSync('src/pages/admin/DietaryDashboard.tsx', file);
