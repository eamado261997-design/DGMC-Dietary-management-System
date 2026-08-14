const fs = require('fs');
let file = fs.readFileSync('src/pages/cashier/CashierTransactions.tsx', 'utf8');

const targetImport = `import { RefreshCw, Ban, CheckCircle2, History, AlertTriangle, Printer, Download } from "lucide-react";`;
const replacementImport = `import { RefreshCw, Ban, CheckCircle2, History, AlertTriangle, Printer, Download } from "lucide-react";
import PrintableHeader from "../../components/PrintableHeader.js";`;

const target = `      {/* Official Print-Only Branding Header */}
      <div className="print-header-brand">
        <h1>Divine Grace Medical Center</h1>
        <p>Compassionate Care, Exceptional Service</p>
        <p className="doc-title">Daily Cashier Transactions History</p>
      </div>
      <div className="print-meta-grid">
        <div className="print-meta-item">
          <span>Register Date: </span>
          <span>{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
        <div className="print-meta-item">
          <span>Logged Cashier ID/Station: </span>
          <span>{transactions[0]?.cashier_name || "Authorized Cashier Station"}</span>
        </div>
      </div>`;

const replacement = `      <PrintableHeader 
        title="Daily Cashier Transactions History"
        meta={[
          { label: "Register Date", value: new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
          { label: "Logged Cashier ID/Station", value: transactions[0]?.cashier_name || "Authorized Cashier Station" }
        ]}
      />`;

file = file.replace(targetImport, replacementImport);
file = file.replace(target, replacement);
fs.writeFileSync('src/pages/cashier/CashierTransactions.tsx', file);
