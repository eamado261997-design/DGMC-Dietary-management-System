import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import PageHeader from "../../components/PageHeader.js";
import { Transaction } from "../../types.js";
import { RefreshCw, Ban, CheckCircle2, History, AlertTriangle, Printer, Download } from "lucide-react";
import PrintableHeader from "../../components/PrintableHeader.js";

export default function CashierTransactions() {
  const { apiFetch } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTodayTransactions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/cashier/transactions");
      setTransactions(data);
    } catch (_err: any) {
      // Suppress error in production
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayTransactions();
  }, []);

  const handleCancelReceipt = async (id: number) => {
    const reason = window.prompt("To void this receipt, please type VOID below:");
    if (!reason || reason.toUpperCase() !== "VOID") {
      alert("Void canceled. Typing does not match 'VOID'.");
      return;
    }

    try {
      await apiFetch(`/api/cashier/transactions/${id}/cancel`, { method: "POST" });
      loadTodayTransactions();
    } catch (err: any) {
      alert(err.message || "Failed to void transaction");
    }
  };

  const downloadCSV = () => {
    if (transactions.length === 0) {
      alert("No transactions to download.");
      return;
    }

    const headers = [
      "Receipt ID",
      "Time",
      "Employee Name",
      "Employee No.",
      "Type",
      "Meal Price",
      "Receipt Status"
    ];

    const csvContent = [
      headers.join(","),
      ...transactions.map(tx => [
        `RX-${tx.id}`,
        tx.meal_time,
        `"${tx.employee_name}"`,
        tx.employee_no || "",
        tx.is_free ? "Complimentary" : "Paid cash",
        tx.meal_amount,
        tx.status
      ].join(","))
    ].join("\\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cashier_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="cashier-transactions-ledger">
      {/* Official Print-Only Branding Header */}
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
      </div>

      <div className="no-print">
        <PageHeader
          title="Transaction History"
          subtitle="Visual table of daily transactions processed at your register. Cancel mistakes instantly here."
          actions={
            <div className="flex gap-2">
              <button
                onClick={downloadCSV}
                className="h-10 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold px-4 flex items-center gap-2"
                title="Download CSV"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="h-10 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold px-4 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Ledger
              </button>
              <button
                onClick={loadTodayTransactions}
                className="p-2 border border-zinc-205 rounded-xl hover:bg-zinc-100 transition-colors flex items-center justify-center h-10 w-10"
                title="Reload Ledger"
              >
                <RefreshCw className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          }
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                  <th className="px-6 py-4">Receipt ID</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Meal Price</th>
                  <th className="px-6 py-4">Receipt Status</th>
                  <th className="px-6 py-4 text-right">Void</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                      No cashier transactions processed today.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-zinc-400">#RX-{tx.id}</td>
                      <td className="px-6 py-4 font-mono text-zinc-500 font-bold">{tx.meal_time}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-zinc-900 block">{tx.employee_name}</span>
                        <span className="text-[10px] text-zinc-450 block font-mono">No. {tx.employee_no}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            tx.is_free
                              ? "bg-emerald-50 text-emerald-800 border-emerald-150"
                              : "bg-teal-50 text-teal-850 border-teal-150"
                          }`}
                        >
                          {tx.is_free ? "Complimentary" : "Paid cash"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-extrabold text-zinc-900">
                        ₱{Number(tx.meal_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                            tx.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                              : "bg-rose-50 text-rose-700 border-rose-150"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              tx.status === "completed" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          ></span>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.status === "completed" ? (
                          <button
                            onClick={() => handleCancelReceipt(tx.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-650 flex items-center justify-center inline-flex ml-auto transition-colors"
                            title="Void Receipt"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-bold uppercase mr-1.5 font-mono">Voided</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cashier safety guidelines */}
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold text-amber-950 block">Important Cashier Protocol</p>
          <p className="leading-relaxed mt-1 text-zinc-700">
            Canceling a complimentary receipt automatically restores the employee's work shift allocation quota for today. Void incorrect entries as soon as possible to allow clinical staff members to pass the scanner again.
          </p>
        </div>
      </div>
    </div>
  );
}
