const fs = require('fs');
let file = fs.readFileSync('src/pages/employee/EmployeeMeals.tsx', 'utf8');

const targetRegex = /\{\/\* Official Print-Only Branding Header \*\/\}[\s\S]*?<\/div>[\s]*<\/div>/;

const replacement = `<PrintableHeader 
        title="Personal Dietary Benefit Claim Ledger"
        meta={[
          { label: "Date Printed", value: new Date().toLocaleString() },
          { label: "Selected Period", value: selectedPeriod === "all" ? "Full History Record" : selectedPeriod === "11_25" ? \`\${months[selectedMonth]} 11th to 25th, \${selectedYear}\` : \`\${months[selectedMonth]} 26th to 10th, \${selectedYear}\` }
        ]}
      />`;

file = file.replace(targetRegex, replacement);
fs.writeFileSync('src/pages/employee/EmployeeMeals.tsx', file);
