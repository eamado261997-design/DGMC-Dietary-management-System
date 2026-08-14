import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { useModal } from "../../context/ModalContext.js";
import PageHeader from "../../components/PageHeader.js";
import VitalSignsLoader from "../../components/VitalSignsLoader.js";
import { Person, Department } from "../../types.js";
import { Plus, Edit2, Trash2, X, Lock, Check, UserCheck, Shield, Search } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../../constants/security.js";
import { validatePasswordComplexity } from "../../utils/password.js";
import { useDebounce } from "../../hooks/useDebounce.js";

export default function SystemUsers() {
  const { apiFetch, user: authUser } = useAuth();
  const { openModal } = useModal();
  const [users, setUsers] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<Person | null>(null);

  const isTargetProtected = editUser && (
    editUser.id === 1 ||
    editUser.role === "admin" ||
    editUser.is_protected === true ||
    editUser.protected === true
  );
  const isFieldsDisabled = isTargetProtected && authUser?.role !== "admin";

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "dietary_admin" | "manager" | "cashier">("manager");
  const [managerDeptId, setManagerDeptId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState("");
  const [minPasswordLength, setMinPasswordLength] = useState(MIN_PASSWORD_LENGTH);

  // Load data
  const loadData = React.useCallback(async () => {
    try {
      const allPeople: Person[] = await apiFetch("/api/admin/people");
      const systemUsers = allPeople.filter((p) => ["admin", "dietary_admin", "manager", "cashier"].includes(p.role));
      const dList = await apiFetch("/api/departments");
      setUsers(systemUsers);
      setDepartments(dList);

      try {
        const settings = await apiFetch("/api/settings");
        if (Array.isArray(settings)) {
          const item = settings.find((s: any) => s.setting_key === "min_password_length");
          if (item && item.setting_value) {
            const val = parseInt(item.setting_value, 10);
            if (!isNaN(val) && val > 0) setMinPasswordLength(val);
          }
        }
      } catch (sErr) {}
    } catch (err: any) {
      setError(err.message || "Failed to load system users.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, []);

  const departmentMap = React.useMemo(() => new Map(departments.map(d => [d.id, d])), [departments]);

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matchSearch =
        fullName.includes(debouncedSearch.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(debouncedSearch.toLowerCase()));

      const matchRole = roleFilter === "" || u.role === roleFilter;

      return matchSearch && matchRole;
    });
  }, [users, debouncedSearch, roleFilter]);

  const openAddModal = () => {
    setEditUser(null);
    setFirstName("");
    setLastName("");
    setUsername("");
    setPassword("");
    setRole("manager");
    setManagerDeptId(departments[0]?.id?.toString() || "");
    setIsActive(true);
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: Person) => {
    setEditUser(u);
    setFirstName(u.first_name);
    setLastName(u.last_name);
    setUsername(u.username);
    setPassword(""); // preserve existing password in field
    setRole(u.role as any);
    setManagerDeptId(u.managed_department_id?.toString() || u.department_id?.toString() || "");
    setIsActive(u.is_active);
    setError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    const targetUser = users.find(u => u.id === id);
    const isTargetProtected = id === 1 || (targetUser && (
      targetUser.role === "admin" ||
      targetUser.is_protected === true ||
      targetUser.protected === true
    ));
    const isDietaryAdmin = authUser?.role !== "admin";

    if (id === 1 || (isDietaryAdmin && isTargetProtected)) {
      alert("Protected System Administrator account is untouchable and cannot be deleted.");
      return;
    }
    openModal(
        "Confirm Deletion",
        "Are you sure you want to delete this system user account?",
        async () => {
            try {
              await apiFetch(`/api/admin/people/${id}`, { method: "DELETE" });
              loadData();
            } catch (err: any) {
              alert(err.message || "Failed to delete user.");
            }
        }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const isTargetProtected = editUser && (
      editUser.id === 1 ||
      editUser.role === "admin" ||
      editUser.is_protected === true ||
      editUser.protected === true
    );
    const isDietaryAdmin = authUser?.role !== "admin";
    if (isDietaryAdmin && isTargetProtected) {
      setError("Protected System Administrator account cannot be modified by other accounts.");
      return;
    }

    if (role === "admin" && isDietaryAdmin) {
      setError("Only System Administrator can assign or manage admin roles.");
      return;
    }

    // Validate password complexity if editing with a new password, or creating a new user
    if (editUser) {
      if (password && password.trim() !== "") {
        const passError = validatePasswordComplexity(password, minPasswordLength);
        if (passError) {
          setError(passError);
          return;
        }
      }
    } else {
      if (!password) {
        setError("Password is required for creating new users.");
        return;
      }
      const passError = validatePasswordComplexity(password, minPasswordLength);
      if (passError) {
        setError(passError);
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      password,
      role,
      department_id: role === "manager" && managerDeptId ? parseInt(managerDeptId, 10) : null,
      managed_department_id: role === "manager" && managerDeptId ? parseInt(managerDeptId, 10) : null,
      is_active: isActive,
    };

    try {
      if (editUser) {
        await apiFetch(`/api/admin/people/${editUser.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/admin/people", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save system credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="system-users-page">
      <PageHeader
        title="System User Management"
        subtitle="Manage access privileges, medical department managers, and dietary transaction cashier registries"
        actions={
          <button
            onClick={openAddModal}
            className="h-10 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add System User
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <VitalSignsLoader size="md" color="teal" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:ring-1 focus:ring-teal-700 outline-none text-zinc-900"
              />
            </div>
            <div className="w-full md:w-60">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:ring-1 focus:ring-teal-700 outline-none text-zinc-600 font-bold"
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
                <thead>
                  <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-250">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Terminal Account Name</th>
                    <th className="px-6 py-4">System Role Tag</th>
                    <th className="px-6 py-4">Responsible Department</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs text-zinc-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold font-sans">
                        No matching users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const mDeptId = u.managed_department_id || u.department_id;
                      const dept = mDeptId ? departmentMap.get(mDeptId) : null;
                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-6 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
                              {u.first_name?.[0] || u.username?.[0] || 'U'}{u.last_name?.[0] || ''}
                            </div>
                            <span className="font-bold text-zinc-900">
                              {u.first_name} {u.last_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-teal-800">{u.username}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold border ${
                                u.role === "admin"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : u.role === "dietary_admin"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : u.role === "manager"
                                  ? "bg-teal-50 text-teal-700 border-teal-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-zinc-800">
                            {dept ? dept.name : u.role === "admin" ? "All Divisions" : "None / General"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                u.is_active ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                              }`}
                            >
                              {u.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(() => {
                                const isTargetProtected = u.id === 1 || u.role === "admin" || u.is_protected === true || u.protected === true;
                                const isDietaryAdmin = authUser?.role !== "admin";
                                const cannotDelete = isDietaryAdmin && isTargetProtected;
                                const isViewOnly = isDietaryAdmin && isTargetProtected;
                                return (
                                  <>
                                    <button
                                      onClick={() => openEditModal(u)}
                                      className="p-1.5 rounded-lg transition-colors hover:bg-zinc-100 text-zinc-550 hover:text-teal-900"
                                      title={isViewOnly ? "View Protected System Administrator (Read-Only)" : "Edit System Privileges"}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(u.id)}
                                      disabled={cannotDelete || u.id === 1}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        cannotDelete || u.id === 1 ? "opacity-30 cursor-not-allowed text-zinc-400" : "hover:bg-rose-50 text-zinc-550 hover:text-rose-600"
                                      }`}
                                      title={u.id === 1 ? "Primary administrator cannot be deleted" : cannotDelete ? "Protected System Administrator account cannot be deleted" : "Delete Registry"}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                );
                              })()}
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
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-zinc-200 shadow-2xl flex flex-col my-auto">
            <div className="p-4 sm:p-6 border-b border-zinc-150 flex items-center justify-between bg-zinc-50 rounded-t-3xl sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-zinc-900">
                  {editUser ? "Edit System User" : "Add System User"}
                </h3>
                {isTargetProtected && (
                  <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider animate-pulse">
                    <Shield className="w-2.5 h-2.5" />
                    Protected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                  {error}
                </div>
              )}

              {isFieldsDisabled && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block">Super-Admin Clearance Required</span>
                    This is a protected system administrator account. You may view its details, but you do not have permission to modify its settings or terminal privileges.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isFieldsDisabled}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isFieldsDisabled}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">Terminal Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isFieldsDisabled}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">System Role Privilege</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    disabled={isFieldsDisabled}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none text-zinc-600 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="manager">Manager (Manage Dept Schedules)</option>
                    <option value="dietary_admin">Dietary Admin (Stats, Dashboard, Employees, Users, Depts, Reports)</option>
                    <option value="cashier">Cashier (Process Meal Barcodes)</option>
                    {authUser?.role === "admin" && (
                      <option value="admin">Administrator (Full Systems Access)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                  Terminal Access Password {editUser && "(Blank to keep unchanged)"}
                </label>
                <input
                  type="password"
                  required={!editUser}
                  placeholder={editUser ? "••••••••" : `Min ${minPasswordLength} chars, numbers, symbols, mixed case`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isFieldsDisabled}
                  className="w-full h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-[9px] text-zinc-400 block mt-1">
                  Must be at least {minPasswordLength} characters, and contain mixed case letters, at least one number, and one symbol.
                </span>
              </div>

              {role === "manager" && (
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-2 text-teal-800">
                    Managed Department Assignment
                  </label>
                  <select
                    required
                    value={managerDeptId}
                    onChange={(e) => setManagerDeptId(e.target.value)}
                    disabled={isFieldsDisabled}
                    className="w-full h-9 px-3 text-xs bg-zinc-50 border border-teal-200 rounded-lg focus:outline-none text-teal-900 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-zinc-400 mt-1 leading-normal">
                    This manager will only be authorized to view and schedule employees belonging to this division.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="user_active_chk"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isFieldsDisabled}
                  className="w-4 h-4 text-teal-700 bg-zinc-50 border-zinc-300 rounded focus:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <label htmlFor="user_active_chk" className="text-[10px] font-bold text-zinc-600 select-none cursor-pointer uppercase">
                  Account is active (permit network access)
                </label>
              </div>

              <div className="border-t border-zinc-150 pt-4 flex items-center justify-end gap-3 bg-white sticky bottom-0 z-10 pb-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="h-9 px-4 border border-zinc-250 text-zinc-550 rounded-lg text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                {!isFieldsDisabled ? (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 px-5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Confirm Credentials"}
                  </button>
                ) : (
                  <div className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-150 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono">
                    <Lock className="w-3.5 h-3.5" />
                    Read-Only Mode
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
