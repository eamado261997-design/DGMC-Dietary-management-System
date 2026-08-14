const fs = require('fs');

let file = fs.readFileSync('src/pages/employee/EmployeeQR.tsx', 'utf8');

// 1. Add Eye and X to lucide-react imports if not already imported
if (!file.includes('Eye,')) {
  file = file.replace('  Printer,', '  Printer,\n  Eye,\n  X,');
}

// 2. Add showPrintPreview state
if (!file.includes('showPrintPreview')) {
  file = file.replace(
    'const [isGeneratingPng, setIsGeneratingPng] = useState<boolean>(false);',
    'const [isGeneratingPng, setIsGeneratingPng] = useState<boolean>(false);\n  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);'
  );
}

// 3. Add Print Preview button before Print Badge
const oldPrintButton = `<button
            onClick={handlePrint}
            className="h-10 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge (CR80)</span>
          </button>`;

const newPrintButtons = `<button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            className="h-10 px-4 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-teal-700" />
            <span>Print Preview</span>
          </button>

          <button
            onClick={handlePrint}
            className="h-10 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all shadow-2xs hover:scale-102"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge (CR80)</span>
          </button>`;

file = file.replace(oldPrintButton, newPrintButtons);

// 4. Add Full-Page Print Preview Overlay Modal before closing component div
const previewModalJSX = `
      {/* FULL-PAGE PRINT PREVIEW OVERLAY MODAL */}
      {showPrintPreview && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex flex-col no-print animate-fade-in">
          {/* Preview Header Bar */}
          <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between text-white shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  Print Preview — Official Document Sheet
                </h3>
                <p className="text-xs text-zinc-400 font-medium mt-0.5">
                  Exact simulation of printed output with PrintableHeader branding and CR80 ID badge
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="h-9 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document Now</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                className="h-9 w-9 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Sheet View Container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center justify-start">
            <div className="bg-white shadow-2xl rounded-sm border border-zinc-300 p-8 sm:p-12 max-w-2xl w-full text-zinc-950 min-h-[700px] flex flex-col justify-between relative">
              
              {/* Top simulated header on paper */}
              <div>
                <PrintableHeader 
                  title="Employee Meal Voucher QR Credential"
                  meta={[
                    { label: "Employee Name", value: \`\${user.first_name} \${user.last_name}\` },
                    { label: "Employee ID", value: user.employee_no || "N/A" },
                    { label: "Department", value: getDeptDisplay() },
                    { label: "Date Printed", value: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) }
                  ]}
                />

                {/* Center Badge preview area with cut-out lines */}
                <div className="my-8 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    <span>CR80 Badge Cut-Out Area (Scale: 100%)</span>
                  </div>
                  
                  <div className="p-4 border-2 border-dashed border-zinc-300 rounded-2xl bg-zinc-50/50 flex items-center justify-center shadow-inner">
                    <div className="printable-badge-card bg-white shadow-md rounded-xl overflow-hidden border" style={{ borderColor: selectedTheme.primary }}>
                      {passMode === "standalone" ? (
                        isPortrait ? (
                          <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0 relative border border-zinc-200" style={{ width: '2.125in', height: '3.375in' }}>
                            <div className="bg-zinc-50 border-b border-zinc-150 p-2 text-center">
                              <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none">{branding.companyName}</h4>
                              <p className="text-[7.5px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">Standalone Dietary Token</p>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center p-2 gap-1">
                              <div className="relative w-20 h-20 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0">
                                {qrDataUrl && <img src={qrDataUrl} alt="Standalone QR Pass" className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                              </div>
                              <span className="text-[7px] font-mono text-zinc-400 tracking-widest">TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                            </div>
                            <div className="p-2 border-t border-zinc-150 bg-zinc-50 text-center">
                              <h5 className="text-xs font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h5>
                              <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{user.position || "Hospital Personnel"}</p>
                              <div className="mt-1 flex items-center justify-center gap-1">
                                <span className="text-[7px] font-mono font-bold text-zinc-400">ID NO:</span>
                                <span className="text-[8px] font-mono font-black text-zinc-800 bg-white border border-zinc-150 px-1.5 py-0.5 rounded">{user.employee_no || "N/A"}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex bg-white text-zinc-950 p-0 relative border border-zinc-200" style={{ width: '3.375in', height: '2.125in' }}>
                            <div className="w-28 border-r border-zinc-150 bg-zinc-50 p-2 flex flex-col items-center justify-center text-center">
                              <div className="relative w-18 h-18 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 shadow-sm shrink-0">
                                {qrDataUrl && <img src={qrDataUrl} alt="Standalone QR Pass" className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                              </div>
                              <span className="text-[6.5px] font-mono text-zinc-400 mt-1 tracking-widest">TKN: {user.qr_code || user.employee_no || "N/A"}</span>
                            </div>
                            <div className="flex-1 p-2 flex flex-col justify-between">
                              <div>
                                <h4 className="text-[10px] font-black tracking-wider text-zinc-800 uppercase leading-none">{branding.companyName}</h4>
                                <p className="text-[7px] text-zinc-500 font-mono tracking-widest uppercase mt-0.5">Standalone Dietary Token</p>
                                <div className="h-px bg-zinc-150 my-1" />
                              </div>
                              <div>
                                <h5 className="text-sm font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h5>
                                <p className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{user.position || "Hospital Personnel"}</p>
                                <p className="text-[7.5px] font-mono mt-0.5 text-zinc-400">ID: {user.employee_no || "N/A"}</p>
                              </div>
                              <div className="text-[6px] text-emerald-600 bg-emerald-50 border border-emerald-150 rounded px-1 py-0.5 font-bold flex items-center gap-0.5 leading-none">
                                <span>VERIFIED SHIFT CLAIM CREDENTIAL</span>
                              </div>
                            </div>
                          </div>
                        )
                      ) : isPortrait ? (
                        <div className="w-full h-full flex flex-col justify-between bg-white text-zinc-950 p-0 relative" style={{ width: '2.125in', height: '3.375in' }}>
                          <div className={\`p-4 text-center flex flex-col items-center shrink-0 \${selectedTheme.bannerBg} relative\`} style={{ height: '0.85in' }}>
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-white leading-none mb-1">{branding.companyName}</h3>
                            <p className="text-[6px] text-zinc-300 font-mono tracking-widest uppercase">Dietary Services Pass</p>
                            <div className="text-[6px] font-bold font-mono tracking-widest uppercase py-0.5 px-2 rounded mt-1 border border-white/20 inline-block text-white" style={{ backgroundColor: selectedTheme.accentColor }}>
                              Verified personnel
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-between p-3 text-center bg-white">
                            <div className="w-14 h-14 rounded-full border-2 border-zinc-100 overflow-hidden relative shadow-md shrink-0 bg-white" style={{ borderColor: selectedTheme.accentColor }}>
                              {renderAvatarContent()}
                            </div>
                            <div className="space-y-0.5 mt-1">
                              <h4 className="text-xs font-black text-zinc-900 leading-none">{user.first_name} {user.last_name}</h4>
                              {showPosition && <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">{user.position || "Medical Staff"}</p>}
                            </div>
                            <div className="relative w-20 h-20 bg-white border border-zinc-200 rounded-xl flex items-center justify-center p-1 overflow-hidden shrink-0">
                              {qrDataUrl && <img src={qrDataUrl} alt="Voucher QR Code" className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                            </div>
                            <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-1 w-full text-[7px] font-mono text-zinc-600">
                              <div className="text-left">
                                <span className="text-zinc-400 block font-bold leading-none">EMP ID:</span>
                                <span className="font-black text-zinc-900 block mt-0.5">{user.employee_no || "N/A"}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-zinc-400 block font-bold leading-none">DIVISION:</span>
                                <span className="font-black text-zinc-900 truncate block mt-0.5">{getDeptDisplay()}</span>
                              </div>
                            </div>
                          </div>
                          {showDisclaimer && (
                            <div className="text-[6px] font-mono bg-zinc-50 border-t border-zinc-100 py-1 text-center text-zinc-400 uppercase tracking-tight shrink-0">
                              Property of {branding.companyName} • Authorized use only
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full flex bg-white text-zinc-950 p-0 relative" style={{ width: '3.375in', height: '2.125in' }}>
                          <div className={\`w-32 h-full flex flex-col justify-between p-3 text-center shrink-0 border-r border-zinc-100 \${selectedTheme.bannerBg}\`} style={{ width: '1.25in' }}>
                            <div className="space-y-1">
                              <h3 className="text-[9px] font-black uppercase tracking-wider text-white leading-tight">{branding.companyName}</h3>
                              <p className="text-[6px] text-zinc-400 font-mono uppercase tracking-widest">Dietary Pass</p>
                            </div>
                            <div className="w-16 h-16 bg-white border border-zinc-150 rounded-lg flex items-center justify-center p-1 mx-auto shadow-sm">
                              {qrDataUrl && <img src={qrDataUrl} alt="Voucher QR Code" className="w-full h-full object-contain" referrerPolicy="no-referrer" />}
                            </div>
                            <div className="text-[6px] font-mono text-white bg-white/10 py-0.5 rounded border border-white/5 truncate">
                              TKN: {user.qr_code || "EMP-001"}
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col justify-between p-3 bg-white">
                            <div className="flex justify-between items-start gap-2">
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-black text-zinc-900 leading-tight tracking-tight">{user.first_name} {user.last_name}</h4>
                                {showPosition && <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">{user.position || "Medical Officer"}</p>}
                              </div>
                              <div className="w-10 h-10 rounded-full border border-zinc-100 overflow-hidden shrink-0 relative bg-white" style={{ borderColor: selectedTheme.accentColor }}>
                                {renderAvatarContent()}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 border-t border-dashed border-zinc-200 pt-2 text-[7px] font-mono text-zinc-600">
                              <div>
                                <span className="text-zinc-400 block font-bold leading-none uppercase">Emp ID</span>
                                <span className="font-black text-zinc-950 block mt-0.5">{user.employee_no || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block font-bold leading-none uppercase">Department</span>
                                <span className="font-black text-zinc-950 truncate block mt-0.5">{getDeptDisplay()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer disclaimer on document */}
              <div className="border-t border-zinc-200 pt-4 mt-8 flex flex-col sm:flex-row items-center justify-between text-[9px] font-mono text-zinc-400 gap-2">
                <span>DIVINE GRACE MEDICAL CENTER • OFFICIAL DIETARY BENEFIT DOCUMENT</span>
                <span>DOCUMENT REF: DGMC-QR-{new Date().getFullYear()}</span>
              </div>

            </div>
          </div>
        </div>
      )}
`;

const lastDivIndex = file.lastIndexOf('</div>');
if (lastDivIndex !== -1) {
  file = file.slice(0, lastDivIndex) + previewModalJSX + '\n' + file.slice(lastDivIndex);
}

fs.writeFileSync('src/pages/employee/EmployeeQR.tsx', file);
console.log('Successfully added Print Preview Overlay Modal');
