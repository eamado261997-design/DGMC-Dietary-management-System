import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { useModal } from "../../context/ModalContext.js";
import PageHeader from "../../components/PageHeader.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { Person, Department } from "../../types.js";
import { Search, Plus, Edit2, Trash2, ShieldAlert, User, Check, X, Building, Upload, FileText, Download, CheckCircle2, AlertCircle, Lock as LockIcon } from "lucide-react";
import { validatePasswordComplexity } from "../../utils/password.js";
import { SecureField } from "../../components/SecureField.js";
import { useDebounce } from "../../hooks/useDebounce.js";

export default function ManageEmployees() {
  const { apiFetch } = useAuth();
  const { openModal } = useModal();
  const [employees, setEmployees] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [deptFilter, setDeptFilter] = useState("");

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Partial<Person> | null>(null);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [personToReset, setPersonToReset] = useState<Person | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  // CSV Import Modal & State
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);
  const [csvErrorMsg, setCsvErrorMsg] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personToReset || isSubmitting) return;
    setResetError(null);

    const passError = validatePasswordComplexity(resetPassword);
    if (passError) {
      setResetError(passError);
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/admin/people/${personToReset.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      setResetModalOpen(false);
      setResetPassword("");
      alert("Password reset successfully.");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Fields
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmpNo, setFormEmpNo] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formQrCode, setFormQrCode] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "inactive">("active");
  const [formHireDate, setFormHireDate] = useState("");

  const loadData = async () => {
    try {
      const pList = await apiFetch("/api/admin/people?role_filter=employee");
      const dList = await apiFetch("/api/departments");
      setEmployees(pList);
      setDepartments(dList);
    } catch (err: any) {
      setError(err.message || "Failed to load employee records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditPerson(null);
    setFormFirstName("");
    setFormLastName("");
    setFormUsername("");
    setFormPassword("");
    setFormEmail("");
    setFormPhone("");
    setFormEmpNo("");
    setFormPosition("");
    setFormDeptId(departments[0]?.id.toString() || "");
    setFormQrCode("");
    setFormStatus("active");
    setFormHireDate(new Date().toISOString().split("T")[0]);
    setError(null);
    setEditorOpen(true);
  };

  const openEditModal = async (p: Person) => {
    setEditPerson(p);
    setFormFirstName(p.first_name);
    setFormLastName(p.last_name);
    setFormUsername(p.username);
    setFormPassword(""); // Left blank to preserve current password
    setFormPosition(p.position || "");
    setFormDeptId(p.department_id?.toString() || "");
    setFormStatus(p.employee_status || "active");
    setFormHireDate(p.hire_date || "");
    setError(null);
    setEditorOpen(true);

    const decryptIfEncrypted = async (val?: string) => {
      if (!val) return "";
      if (val.startsWith("enc:") || val.startsWith("enc_det:")) {
        try {
          const res = await apiFetch("/api/admin/decrypt-field", {
            method: "POST",
            body: JSON.stringify({ ciphertext: val })
          });
          return res.decrypted || val;
        } catch (e) {
          console.error("Failed to decrypt field during edit:", e);
          return val;
        }
      }
      return val;
    };

    setFormEmail(p.email && (p.email.startsWith("enc:") || p.email.startsWith("enc_det:")) ? "Decrypting..." : p.email || "");
    setFormPhone(p.phone && (p.phone.startsWith("enc:") || p.phone.startsWith("enc_det:")) ? "Decrypting..." : p.phone || "");
    setFormEmpNo(p.employee_no && (p.employee_no.startsWith("enc:") || p.employee_no.startsWith("enc_det:")) ? "Decrypting..." : p.employee_no || "");
    setFormQrCode(p.qr_code && (p.qr_code.startsWith("enc:") || p.qr_code.startsWith("enc_det:")) ? "Decrypting..." : p.qr_code || "");

    const decryptedEmail = await decryptIfEncrypted(p.email);
    const decryptedPhone = await decryptIfEncrypted(p.phone);
    const decryptedEmpNo = await decryptIfEncrypted(p.employee_no);
    const decryptedQrCode = await decryptIfEncrypted(p.qr_code);

    setFormEmail(decryptedEmail);
    setFormPhone(decryptedPhone);
    setFormEmpNo(decryptedEmpNo);
    setFormQrCode(decryptedQrCode);
  };

  const handleDelete = async (id: number) => {
    openModal(
        "Confirm Deletion",
        "Are you sure you want to delete or deactivate this employee profile record? This is irreversible.",
        async () => {
            try {
              await apiFetch(`/api/admin/people/${id}`, { method: "DELETE" });
              loadData();
            } catch (err: any) {
              alert(err.message || "Failed to delete record.");
            }
        }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    // Guard against submitting pending decryption state
    if (formEmail === "Decrypting..." || formPhone === "Decrypting..." || formEmpNo === "Decrypting..." || formQrCode === "Decrypting...") {
      setError("Please wait until sensitive fields are decrypted before saving.");
      return;
    }

    // Validate password complexity if editing with a new password, or creating a new employee
    if (editPerson && editPerson.id) {
      if (formPassword && formPassword.trim() !== "") {
        const passError = validatePasswordComplexity(formPassword);
        if (passError) {
          setError(passError);
          return;
        }
      }
    } else {
      if (!formPassword) {
        setError("Password is required for introducing new personnel.");
        return;
      }
      const passError = validatePasswordComplexity(formPassword);
      if (passError) {
        setError(passError);
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      first_name: formFirstName.trim(),
      last_name: formLastName.trim(),
      username: formUsername.trim(),
      password: formPassword,
      role: "employee",
      email: formEmail.trim(),
      phone: formPhone.trim(),
      employee_no: formEmpNo.trim(),
      position: formPosition.trim(),
      department_id: formDeptId ? parseInt(formDeptId, 10) : null,
      qr_code: formQrCode.trim(),
      employee_status: formStatus,
      hire_date: formHireDate,
      is_active: formStatus === "active",
    };

    try {
      if (editPerson && editPerson.id) {
        // Edit Operation
        await apiFetch(`/api/admin/people/${editPerson.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        // Add Operation
        await apiFetch("/api/admin/people", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setEditorOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Error submitting form registry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Parsing helper
  const parseCSV = (text: string) => {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const parseLine = (line: string) => {
      const result = [];
      let insideQuote = false;
      let entry = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(entry.trim());
          entry = "";
        } else {
          entry += char;
        }
      }
      result.push(entry.trim());
      return result.map(s => s.replace(/^"|"$/g, ""));
    };

    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseLine(lines[i]);
      const obj: any = {};
      headers.forEach((h, index) => {
        obj[h] = values[index] || "";
      });
      rows.push(obj);
    }
    return { headers, rows };
  };

  const handleFileUploadEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string || "";
      setCsvRawText(text);
      processCsvText(text);
    };
    reader.readAsText(file);
  };

  const processCsvText = (text: string) => {
    setCsvErrorMsg(null);
    setCsvSuccessMsg(null);
    try {
      const { rows } = parseCSV(text);
      if (rows.length === 0) {
        setCsvErrorMsg("No rows found in CSV data.");
        setParsedRows([]);
        return;
      }
      const formatted = rows.map((r, index) => {
        const firstName = r.first_name || r.firstname || r.First || "";
        const lastName = r.last_name || r.lastname || r.Last || "";
        const username = r.username || r.user || (firstName && lastName ? `${firstName[0].toLowerCase()}${lastName.toLowerCase()}` : `user${index}`);
        const password = r.password || "SecurePass123!";
        const empNo = r.employee_no || r.emp_no || r.employee_id || `EMP${100 + index}`;
        const deptId = r.department_id || r.dept_id || departments[0]?.id?.toString() || "1";
        const position = r.position || "Staff";
        const email = r.email || "";
        const phone = r.phone || "";
        const hireDate = r.hire_date || r.hiredate || new Date().toISOString().split("T")[0];

        const isValid = Boolean(firstName && lastName && username && empNo);
        return {
          first_name: firstName,
          last_name: lastName,
          username,
          password,
          employee_no: empNo,
          department_id: deptId,
          position,
          email,
          phone,
          hire_date: hireDate,
          isValid,
          errorReason: !isValid ? "Missing required fields (first_name, last_name, username, employee_no)" : null
        };
      });
      setParsedRows(formatted);
    } catch (err: any) {
      setCsvErrorMsg(err.message || "Failed to parse CSV format.");
      setParsedRows([]);
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "first_name,last_name,username,password,employee_no,department_id,position,email,phone,hire_date\n" +
      "Jane,Doe,jdoe,SecurePass123!,EMP101,1,Staff Nurse,jane@hospital.com,+639123456789,2026-01-15\n" +
      "John,Smith,jsmith,SecurePass456!,EMP102,2,Radiologist,john@hospital.com,+639987654321,2026-02-01";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "employee_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteCsvImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setCsvErrorMsg("No valid employee rows to import.");
      return;
    }

    setImportingCsv(true);
    setCsvErrorMsg(null);
    try {
      let importedCount = 0;
      for (const row of validRows) {
        const payload = {
          first_name: row.first_name,
          last_name: row.last_name,
          username: row.username,
          password: row.password,
          role: "employee",
          email: row.email,
          phone: row.phone,
          employee_no: row.employee_no,
          position: row.position,
          department_id: parseInt(row.department_id, 10) || departments[0]?.id || 1,
          qr_code: row.employee_no,
          employee_status: "active",
          hire_date: row.hire_date,
          is_active: true
        };
        await apiFetch("/api/admin/people", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        importedCount++;
      }
      setCsvSuccessMsg(`Successfully bulk imported ${importedCount} employee records!`);
      loadData();
      setTimeout(() => {
        setCsvModalOpen(false);
        setCsvSuccessMsg(null);
        setParsedRows([]);
        setCsvRawText("");
      }, 1500);
    } catch (err: any) {
      setCsvErrorMsg(err.message || "Failed during bulk import execution.");
    } finally {
      setImportingCsv(false);
    }
  };

  // Filter List
  const filteredEmployees = employees.filter((p) => {
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchSearch =
      fullName.includes(debouncedSearch.toLowerCase()) ||
      (p.employee_no && p.employee_no.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
      (p.username && p.username.toLowerCase().includes(debouncedSearch.toLowerCase()));

    const matchDept = deptFilter === "" || p.department_id?.toString() === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div id="manage-employees-page">
      <PageHeader
        title="Healthcare Practitioner Registry"
        subtitle="Configure hospital healthcare practitioners profiles and active QR barcode benefits"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCsvRawText("");
                setParsedRows([]);
                setCsvErrorMsg(null);
                setCsvSuccessMsg(null);
                setCsvModalOpen(true);
              }}
              className="h-10 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={openAddModal}
              className="h-10 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        }
      />

      {/* Roster Controls */}
      <div className="bg-white border border-zinc-200 rounded-3xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, employee no, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:ring-1 focus:ring-teal-700 outline-none text-zinc-900"
          />
        </div>
        <div className="w-full md:w-60">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:ring-1 focus:ring-teal-700 outline-none text-zinc-600 font-bold"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <VitalSignsLoader size="md" color="teal" />
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                  <th className="px-6 py-4">Employee info</th>
                  <th className="px-6 py-4">Employee ID</th>
                  <th className="px-6 py-4">Department / Position</th>
                  <th className="px-6 py-4">QR Payload</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold font-sans">
                      No matching registered employees discoverable
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((e) => {
                    const dept = departments.find((d) => d.id === e.department_id);
                    return (
                      <tr key={e.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold font-mono text-[10px]">
                            {e.first_name[0]}{e.last_name[0]}
                          </div>
                          <div>
                            <span className="font-bold text-zinc-900 block">
                              {e.first_name} {e.last_name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono block">usr: {e.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <SecureField value={e.employee_no} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-zinc-800 block">{dept?.name || "N/A"}</span>
                          <span className="text-[10px] text-zinc-500 block">{e.position || "Staff"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <SecureField value={e.qr_code} />
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              e.employee_status === "active"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                e.employee_status === "active" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            ></span>
                            {e.employee_status || "active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(e)}
                              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-550 hover:text-teal-900 transition-colors"
                              title="Edit Employee Detail"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setPersonToReset(e);
                                setResetModalOpen(true);
                              }}
                              className="p-1.5 hover:bg-teal-50 rounded-lg text-zinc-550 hover:text-teal-700 transition-colors"
                              title="Reset Password"
                            >
                              <LockIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-zinc-550 hover:text-rose-600 transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor Modal Overlay */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {editPerson ? "Edit Employee Profile" : "Register New Employee"}
                </h3>
                <p className="text-[10px] text-zinc-550 mt-0.5">Maintain core medical team dataset and credentials</p>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-4 flex-1">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Profile Username *</label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                    Terminal Password {editPerson && "(Blank: Keep unchanged)"}
                  </label>
                  <input
                    type="password"
                    required={!editPerson}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editPerson ? "Unchanged" : "Min 12 chars, numbers, symbols, mixed case"}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                  <span className="text-[9px] text-zinc-400 block mt-1">
                    Must be at least 12 characters, and contain mixed case letters, at least one number, and one symbol.
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Employee No. / PIN Code *</label>
                  <input
                    type="text"
                    required
                    value={formEmpNo}
                    onChange={(e) => setFormEmpNo(e.target.value)}
                    placeholder="e.g. EMP001"
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white font-mono font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">QR Card Payload String</label>
                  <input
                    type="text"
                    value={formQrCode}
                    onChange={(e) => setFormQrCode(e.target.value)}
                    placeholder="Leave blank to auto-generate same as Employee ID"
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Hospital Department *</label>
                  <select
                    required
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white text-zinc-600 font-bold"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Position / Title</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="e.g. Resident Nurse, Technician"
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Personnel Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white text-zinc-600 font-bold"
                  >
                    <option value="active">Active (Permit Cafeteria Access)</option>
                    <option value="inactive">Inactive Employee (Suspended Accounts)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Date of Hire</label>
                  <input
                    type="date"
                    value={formHireDate}
                    onChange={(e) => setFormHireDate(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Contact Number</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+63 9xx..."
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-150 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  disabled={isSubmitting}
                  className="h-9 px-4 border border-zinc-250 text-zinc-550 rounded-lg text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save personnel profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-4xl border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 rounded-t-3xl">
              <div>
                <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-teal-700" />
                  Bulk Import Employee Records via CSV Parser
                </h3>
                <p className="text-[10px] text-zinc-550 mt-0.5">Upload a CSV file or paste raw CSV data to register multiple practitioners instantly</p>
              </div>
              <button
                onClick={() => setCsvModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {csvSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{csvSuccessMsg}</span>
                </div>
              )}
              {csvErrorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{csvErrorMsg}</span>
                </div>
              )}

              {/* Template download & file input */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">CSV Format &amp; Template Guide</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Required headers: <code className="font-mono text-teal-700 bg-teal-50 px-1 py-0.5 rounded">first_name, last_name, username, password, employee_no</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-teal-700" />
                  <span>Download CSV Template</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Upload CSV File</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUploadEvent}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer border border-zinc-200 rounded-xl p-2 bg-zinc-50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-700 block">Or Paste Raw CSV Data</label>
                  <textarea
                    rows={3}
                    value={csvRawText}
                    onChange={(e) => {
                      setCsvRawText(e.target.value);
                      processCsvText(e.target.value);
                    }}
                    placeholder="first_name,last_name,username,password,employee_no..."
                    className="w-full p-3 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-1 focus:ring-teal-700 outline-none"
                  ></textarea>
                </div>
              </div>

              {/* Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-zinc-800 font-mono uppercase tracking-wider">
                      Parsed Rows Preview ({parsedRows.length} total, {parsedRows.filter(r => r.isValid).length} valid)
                    </span>
                  </div>

                  <div className="border border-zinc-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono uppercase text-zinc-400 sticky top-0">
                          <th className="py-2.5 px-3 font-bold">Status</th>
                          <th className="py-2.5 px-3 font-bold">Name</th>
                          <th className="py-2.5 px-3 font-bold">Username</th>
                          <th className="py-2.5 px-3 font-bold">Employee No</th>
                          <th className="py-2.5 px-3 font-bold">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? "hover:bg-zinc-50" : "bg-rose-50/50 hover:bg-rose-50"}>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200" title={row.errorReason}>
                                  <AlertCircle className="w-3 h-3" /> Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-zinc-800">{row.first_name} {row.last_name}</td>
                            <td className="py-2 px-3 font-mono text-zinc-600">{row.username}</td>
                            <td className="py-2 px-3 font-mono font-bold text-zinc-900">{row.employee_no}</td>
                            <td className="py-2 px-3 text-zinc-500">{row.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-150 bg-zinc-50 rounded-b-3xl flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCsvModalOpen(false)}
                className="h-10 px-4 border border-zinc-250 text-zinc-650 rounded-xl text-xs font-bold hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importingCsv || parsedRows.filter(r => r.isValid).length === 0}
                onClick={handleExecuteCsvImport}
                className="h-10 px-6 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {importingCsv && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>Import {parsedRows.filter(r => r.isValid).length} Valid Records</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reset Password Modal */}
      {resetModalOpen && personToReset && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm border border-zinc-200 shadow-2xl p-6">
            <h3 className="text-sm font-black text-zinc-900 mb-1">Reset Password</h3>
            <p className="text-[10px] text-zinc-550 mb-4">Set a new password for {personToReset.first_name} {personToReset.last_name}</p>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              {resetError && (
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] rounded-lg font-bold">
                  {resetError}
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-bold text-zinc-600 block mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 text-[10px] font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-[10px] font-bold text-white bg-teal-800 hover:bg-teal-900 rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
