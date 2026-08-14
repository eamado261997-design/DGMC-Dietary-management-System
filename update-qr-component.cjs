const fs = require('fs');

let content = fs.readFileSync('src/pages/employee/EmployeeQR.tsx', 'utf8');

// 1. Add PrintableHeader import
if (!content.includes('PrintableHeader')) {
  content = content.replace(
    'import DGMCLogo from "../../components/DGMCLogo.js";',
    'import DGMCLogo from "../../components/DGMCLogo.js";\nimport PrintableHeader from "../../components/PrintableHeader.js";'
  );
}

// 2. Add exportFormat state if not exists
if (!content.includes('exportFormat')) {
  content = content.replace(
    'const [isGeneratingPng, setIsGeneratingPng] = useState(false);',
    'const [isGeneratingPng, setIsGeneratingPng] = useState(false);\n  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");'
  );

  // 3. Add handleDownloadSvg and handleDownloadExport
  const handleSvgCode = `
  // Handle SVG download for QR code
  const handleDownloadSvg = async () => {
    try {
      const code = (useSecureCrypto && securePayload) 
        ? securePayload 
        : (user.qr_code || user.employee_no || "EMP-001");

      const svgString = await QRCode.toString(code, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 1,
        color: {
          dark: selectedTheme.id === "cosmic" ? "#000000" : selectedTheme.primary,
          light: "#ffffff",
        },
      });

      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = \`DGMC_QR_\${user.first_name}_\${user.last_name}.svg\`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate SVG QR code:", err);
    }
  };

  const handleDownloadExport = () => {
    if (exportFormat === "svg") {
      handleDownloadSvg();
    } else {
      handleDownloadPng();
    }
  };
`;

  content = content.replace(
    '// Trigger browser printing',
    handleSvgCode + '\n  // Trigger browser printing'
  );
}

// 4. Update Header Buttons to include Format Selector & handleDownloadExport
const oldButtons = `<button
            onClick={handleDownloadPng}
            disabled={isGeneratingPng}
            className="h-10 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102 disabled:opacity-50"
          >
            {isGeneratingPng ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download High-Res PNG</span>
          </button>`;

const newButtons = `<div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setExportFormat("png")}
              className={\`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer \${
                exportFormat === "png"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }\`}
            >
              PNG
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("svg")}
              className={\`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all cursor-pointer \${
                exportFormat === "svg"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-800"
              }\`}
            >
              SVG
            </button>
          </div>

          <button
            onClick={handleDownloadExport}
            disabled={isGeneratingPng}
            className="h-10 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102 disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingPng ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download ({exportFormat.toUpperCase()})</span>
          </button>`;

content = content.replace(oldButtons, newButtons);

// 5. Inject PrintableHeader into print-card-wrapper
const oldPrintWrapperTarget = `<div className="hidden print-card-wrapper">
        <div className="printable-badge-card bg-white" style={{ borderColor: selectedTheme.primary }}>`;

const newPrintWrapperReplacement = `<div className="hidden print-card-wrapper">
        <PrintableHeader 
          title="Employee Meal Voucher QR Credential"
          meta={[
            { label: "Employee Name", value: \`\${user.first_name} \${user.last_name}\` },
            { label: "Employee ID", value: user.employee_no || "N/A" },
            { label: "Department", value: getDeptDisplay() },
            { label: "Date Printed", value: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) }
          ]}
        />
        <div className="printable-badge-card bg-white" style={{ borderColor: selectedTheme.primary }}>`;

content = content.replace(oldPrintWrapperTarget, newPrintWrapperReplacement);

// 6. Make sure no-print / non-printable class is attached to screen containers
content = content.replace(/className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm non-printable"/g, 'className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm no-print non-printable"');

fs.writeFileSync('src/pages/employee/EmployeeQR.tsx', content);
console.log('Successfully updated EmployeeQR.tsx');
