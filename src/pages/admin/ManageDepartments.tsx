import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { useModal } from "../../context/ModalContext.js";
import PageHeader from "../../components/PageHeader.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { Department } from "../../types.js";
import { Plus, Edit2, Trash2, X, Building, ShieldAlert } from "lucide-react";

export default function ManageDepartments() {
  const { apiFetch } = useAuth();
  const { openModal } = useModal();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");

  const loadDepartments = async () => {
    try {
      const list = await apiFetch("/api/departments");
      setDepartments(list);
    } catch (err: any) {
      setError(err.message || "Failed to load departments roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const openAddModal = () => {
    setEditDept(null);
    setDeptName("");
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (d: Department) => {
    setEditDept(d);
    setDeptName(d.name);
    setError(null);
    setModalOpen(true);
  };
  const handleDelete = async (id: number) => {
    openModal(
        "Confirm Deletion",
        "Are you sure you want to delete this department?",
        async () => {
            try {
              await apiFetch(`/api/departments/${id}`, { method: "DELETE" });
              loadDepartments();
            } catch (err: any) {
              alert(err.message || "Failed to delete department.");
            }
        }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!deptName.trim()) {
      setError("Department name is required.");
      return;
    }

    try {
      if (editDept) {
        await apiFetch(`/api/departments/${editDept.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: deptName.trim() }),
        });
      } else {
        await apiFetch("/api/departments", {
          method: "POST",
          body: JSON.stringify({ name: deptName.trim() }),
        });
      }
      setModalOpen(false);
      loadDepartments();
    } catch (err: any) {
      setError(err.message || "Error saving department.");
    }
  };

  return (
    <div id="manage-departments-page">
      <PageHeader
        title="Department Management"
        subtitle="Configure primary hospital operations divisions, nursing squads, and medical modules"
        actions={
          <button
            onClick={openAddModal}
            className="h-10 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Department
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <VitalSignsLoader size="md" color="teal" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Table Block */}
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs h-max">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Division Name</th>
                    <th className="px-6 py-4">Registered On</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No departments currently registered.
                      </td>
                    </tr>
                  ) : (
                    departments.map((d) => (
                      <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-zinc-400">{d.id}</td>
                        <td className="px-6 py-4 font-bold text-zinc-900">{d.name}</td>
                        <td className="px-6 py-4 text-zinc-500 font-mono">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(d)}
                              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-550 hover:text-teal-900 transition-colors"
                              title="Rename Division"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(d.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-zinc-550 hover:text-rose-600 transition-colors"
                              title="Remove Division"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Informative Card */}
          <div className="bg-zinc-55/10 border border-zinc-200 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 mb-4 border border-teal-200">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Hospital Department Setup</h3>
              <p className="text-xs text-zinc-550 mt-2 leading-relaxed">
                Hospital departments serve as isolation contexts for employees schedules. Managers allocated to specific departments can only edit internal rosters of employees nested within their exact division.
              </p>
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-bold text-amber-900">Protective Lock:</span> You cannot delete standard departments that possess current personnel rosters. Please relocate/edit personnel before deleting their central divisions namespace.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm border border-zinc-200 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-150 mb-4">
              <h3 className="text-sm font-black text-zinc-900">
                {editDept ? "Rename Department" : "Create New Department"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-650 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                  {error}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-zinc-600 block uppercase tracking-wider mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pediatric Ward"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full h-10 px-3.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white text-zinc-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 border border-zinc-250 text-zinc-550 rounded-lg text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
