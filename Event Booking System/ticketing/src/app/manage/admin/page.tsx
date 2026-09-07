"use client";

import { FormEvent, useEffect, useState } from "react";
import StaffShell from "../staff-shell";

type Permission = { id: string; key: string; isLocked: boolean };
type Role = { id: string; name: string; isSystem: boolean; isLocked: boolean; permissionIds: string[] };
type Category = { id: string; name: string; slug: string; sortOrder: number };

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [staff, setStaff] = useState({ displayName: "", email: "", password: "", roleId: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/access", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error || "Admin settings are unavailable."); return; }
    setCategories(data.categories || []);
    setRoles(data.roles || []);
    setPermissions(data.permissions || []);
    const selected = data.roles?.find((role: Role) => role.id === selectedRoleId) || data.roles?.find((role: Role) => !role.isLocked);
    if (selected) { setSelectedRoleId(selected.id); setSelectedPermissions(selected.permissionIds); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(() => setMessage("Admin settings are unavailable.")); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function slugify(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  async function submit(action: string, body: object) {
    setMessage("");
    const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error || "Could not save admin settings."); return false; }
    await load();
    return true;
  }
  async function addCategory(event: FormEvent) { event.preventDefault(); if (await submit("createCategory", { name: categoryName, slug: slugify(categoryName) })) { setCategoryName(""); setMessage("Event classification added."); } }
  async function addRole(event: FormEvent) { event.preventDefault(); if (await submit("createRole", { name: roleName, permissionIds: [] })) { setRoleName(""); setMessage("Role created. Select it to assign permissions."); } }
  async function savePermissions() { if (await submit("setRolePermissions", { roleId: selectedRoleId, permissionIds: selectedPermissions })) setMessage("Role permissions saved."); }
  async function addStaff(event: FormEvent) { event.preventDefault(); if (await submit("createStaff", staff)) { setStaff({ displayName: "", email: "", password: "", roleId: "" }); setMessage("Staff account created. They can now sign in with the assigned role."); } }
  async function editCategory(category: Category) { const name = window.prompt("Classification name", category.name); if (!name?.trim()) return; const sortOrder = Number(window.prompt("Display order (lower appears first)", String(category.sortOrder))); if (!Number.isInteger(sortOrder) || sortOrder < 0) { setMessage("Enter a whole display order of zero or more."); return; } if (await submit("updateCategory", { id: category.id, name: name.trim(), slug: slugify(name), sortOrder })) setMessage("Event classification saved."); }
  async function removeCategory(category: Category) { if (!window.confirm(`Remove "${category.name}"? This only works when no events use it.`)) return; if (await submit("deleteCategory", { id: category.id })) setMessage("Event classification removed."); }
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  return (
    <StaffShell active="admin" title="Admin">
      <section className="staff-page-heading"><div><p className="eyebrow">System administration</p><h2>Access and configuration</h2><p>Manage classifications, staff roles and permission boundaries for the ticketing operation.</p></div></section>
      <section className="staff-page-panel admin-workspace">
        {message && <p className="cms-banner success" role="status">{message}</p>}
        <div className="admin-grid">
          <section className="cms-card"><div className="card-heading"><div><p className="eyebrow">Event setup</p><h2>Classifications</h2></div></div><p className="panel-copy">Classifications appear in the event editor for staff to apply to new and existing events.</p><ul className="admin-list">{categories.map((category) => <li key={category.id}><div><strong>{category.name}</strong><small>{category.slug} · order {category.sortOrder}</small></div><span className="admin-row-actions"><button className="table-action" type="button" onClick={() => editCategory(category)}>Edit</button><button className="table-action" type="button" onClick={() => removeCategory(category)}>Remove</button></span></li>)}</ul><form className="admin-inline-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New classification" required /><button className="table-action" type="submit">Add</button></form></section>
          <section className="cms-card"><div className="card-heading"><div><p className="eyebrow">Access model</p><h2>Roles</h2></div></div><div className="role-picker">{roles.map((role) => <button className={role.id === selectedRoleId ? "active" : ""} key={role.id} type="button" onClick={() => { setSelectedRoleId(role.id); setSelectedPermissions(role.permissionIds); }}><strong>{role.name}</strong><small>{role.isLocked ? "Full access" : `${role.permissionIds.length} permissions`}</small></button>)}</div><form className="admin-inline-form" onSubmit={addRole}><input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="New role name" required /><button className="table-action" type="submit">Create</button></form></section>
        </div>
        <section className="cms-card permissions-panel"><div className="card-heading"><div><p className="eyebrow">Permission module</p><h2>{selectedRole ? `${selectedRole.name} permissions` : "Select a role"}</h2></div></div>{selectedRole?.isLocked ? <p className="panel-copy">The Admin role is locked and always has access to every permission.</p> : <><div className="permission-grid">{permissions.map((permission) => <label className="permission-option" key={permission.id}><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /><span>{permission.key}</span>{permission.isLocked && <small>System</small>}</label>)}</div><button className="primary-button" type="button" onClick={savePermissions} disabled={!selectedRoleId}>Save permissions</button></>}</section>
        <section className="cms-card permissions-panel"><div className="card-heading"><div><p className="eyebrow">Staff accounts</p><h2>Create staff sign-in</h2></div></div><form className="cms-form" onSubmit={addStaff}><label>Display name<input value={staff.displayName} onChange={(event) => setStaff({ ...staff, displayName: event.target.value })} required /></label><label>Email address<input type="email" value={staff.email} onChange={(event) => setStaff({ ...staff, email: event.target.value })} required /></label><label>Temporary password<input type="password" minLength={12} value={staff.password} onChange={(event) => setStaff({ ...staff, password: event.target.value })} required /></label><label>Role<select value={staff.roleId} onChange={(event) => setStaff({ ...staff, roleId: event.target.value })} required><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="primary-button" type="submit">Create staff account</button></form></section>
      </section>
    </StaffShell>
  );
}
