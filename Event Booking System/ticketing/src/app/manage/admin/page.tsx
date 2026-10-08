"use client";

import { FormEvent, useEffect, useState } from "react";
import StaffShell from "../staff-shell";

type Permission = { id: string; key: string; isLocked: boolean };
type Role = { id: string; name: string; isSystem: boolean; isLocked: boolean; permissionIds: string[] };
type Category = { id: string; name: string; slug: string; sortOrder: number };
type StaffMember = { id: string; email: string; displayName: string | null; status: string; lastSignedInAt: string | null; roleName: string | null };

function formatSignIn(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never signed in";
}

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [staffEdit, setStaffEdit] = useState<{ id: string; mode: "reset" | "rename"; value: string } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [staff, setStaff] = useState({ displayName: "", email: "", password: "", roleId: "" });
  const [staffPasswordVisible, setStaffPasswordVisible] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [dataUnavailable, setDataUnavailable] = useState(true);

  async function load() {
    const response = await fetch("/api/admin/access", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setDataUnavailable(true); setMessageType("error"); setMessage(data.error || "Admin settings are unavailable."); return; }
    setDataUnavailable(false);
    setCategories(data.categories || []);
    setRoles(data.roles || []);
    setPermissions(data.permissions || []);
    setStaffMembers(data.staff || []);
    setCurrentUserId(data.currentUserId ?? null);
    const selected = data.roles?.find((role: Role) => role.id === selectedRoleId) || data.roles?.find((role: Role) => !role.isLocked);
    if (selected) { setSelectedRoleId(selected.id); setSelectedPermissions(selected.permissionIds); }
  }

  useEffect(() => {
    fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Admin settings are unavailable.");
        setDataUnavailable(false);
        setCategories(data.categories || []);
        setRoles(data.roles || []);
        setPermissions(data.permissions || []);
        setStaffMembers(data.staff || []);
        setCurrentUserId(data.currentUserId ?? null);
        const selected = data.roles?.find((role: Role) => role.id === selectedRoleId) || data.roles?.find((role: Role) => !role.isLocked);
        if (selected) { setSelectedRoleId(selected.id); setSelectedPermissions(selected.permissionIds); }
      })
      .catch((error) => { setDataUnavailable(true); setMessageType("error"); setMessage(error instanceof Error ? error.message : "Admin settings are unavailable."); });
  }, []);

  function slugify(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  async function submit(action: string, body: object) {
    setMessage("");
    const response = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessageType("error"); setMessage(data.error || "Could not save admin settings."); return false; }
    await load();
    return true;
  }
  async function addCategory(event: FormEvent) { event.preventDefault(); if (await submit("createCategory", { name: categoryName, slug: slugify(categoryName) })) { setCategoryName(""); setMessageType("success"); setMessage("Event category added."); } }
  async function addRole(event: FormEvent) { event.preventDefault(); if (await submit("createRole", { name: roleName, permissionIds: [] })) { setRoleName(""); setMessageType("success"); setMessage("Role created. Select it to assign permissions."); } }
  async function savePermissions() { if (await submit("setRolePermissions", { roleId: selectedRoleId, permissionIds: selectedPermissions })) { setMessageType("success"); setMessage("Role permissions saved."); } }
  async function addStaff(event: FormEvent) { event.preventDefault(); if (await submit("createStaff", staff)) { setStaff({ displayName: "", email: "", password: "", roleId: "" }); setMessageType("success"); setMessage("Staff account created. They can now sign in with the assigned role."); } }
  function generateStaffPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const values = new Uint32Array(18);
    crypto.getRandomValues(values);
    const password = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
    setStaff((current) => ({ ...current, password }));
    setStaffPasswordVisible(true);
  }
  async function copyStaffPassword() {
    if (!staff.password) return;
    await navigator.clipboard.writeText(staff.password);
    setMessageType("success");
    setMessage("Temporary password copied. It will not be shown again after leaving this form.");
  }
  async function editCategory(category: Category) { const name = window.prompt("Category name", category.name); if (!name?.trim()) return; const sortOrder = Number(window.prompt("Display order (lower appears first)", String(category.sortOrder))); if (!Number.isInteger(sortOrder) || sortOrder < 0) { setMessageType("error"); setMessage("Enter a whole display order of zero or more."); return; } if (await submit("updateCategory", { id: category.id, name: name.trim(), slug: slugify(name), sortOrder })) { setMessageType("success"); setMessage("Event category saved."); } }
  async function removeCategory(category: Category) { if (!window.confirm(`Remove "${category.name}"? This only works when no events use it.`)) return; if (await submit("deleteCategory", { id: category.id })) { setMessageType("success"); setMessage("Event classification removed."); } }
  async function toggleStaffStatus(member: StaffMember) {
    const disabling = member.status === "active";
    if (disabling && window.confirm(`Disable ${member.email}? They will be signed out and unable to sign in until re-enabled.`) === false) return;
    if (await submit("setStaffStatus", { userId: member.id, status: disabling ? "disabled" : "active" })) { setMessageType("success"); setMessage(disabling ? `${member.email} has been disabled.` : `${member.email} can sign in again.`); }
  }
  async function saveStaffEdit(event: FormEvent, member: StaffMember) {
    event.preventDefault();
    if (staffEdit === null) return;
    if (staffEdit.mode === "reset") {
      if (staffEdit.value.length < 12) { setMessageType("error"); setMessage("The temporary password must be at least 12 characters."); return; }
      if (await submit("resetStaffPassword", { userId: member.id, password: staffEdit.value })) { setStaffEdit(null); setMessageType("success"); setMessage(`Password reset for ${member.email}. They have been signed out and must choose a new password when they next sign in.`); }
      return;
    }
    if (staffEdit.value.trim().length < 2) { setMessageType("error"); setMessage("Enter a display name of at least 2 characters."); return; }
    if (await submit("renameStaff", { userId: member.id, displayName: staffEdit.value.trim() })) { setStaffEdit(null); setMessageType("success"); setMessage(`Display name updated for ${member.email}.`); }
  }
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  return (
    <StaffShell active="admin" title="Admin">
      <section className="staff-page-heading"><div><p className="eyebrow">System administration</p><h2>Access and configuration</h2><p>Manage event categories, staff roles and permission boundaries for the ticketing operation.</p></div></section>
      <section className="staff-page-panel admin-workspace">
        {message && <p className={`cms-banner ${messageType}`} role={messageType === "error" ? "alert" : "status"}>{message}</p>}
        {dataUnavailable && !message && <p className="cms-banner error" role="alert">Admin settings are unavailable. Categories, roles and staff actions are disabled until this is restored.</p>}
        <div className="admin-grid">
          <section id="admin-categories" className="cms-card"><div className="card-heading"><div><p className="eyebrow">Event setup</p><h2>Classifications</h2></div></div><p className="panel-copy">Classifications appear in the event editor for staff to apply to new and existing events.</p><ul className="admin-list">{categories.map((category) => <li key={category.id}><div><strong>{category.name}</strong><small>{category.slug} · order {category.sortOrder}</small></div><span className="admin-row-actions"><button className="table-action" type="button" disabled={dataUnavailable} onClick={() => editCategory(category)}>Edit</button><button className="table-action" type="button" disabled={dataUnavailable} onClick={() => removeCategory(category)}>Remove</button></span></li>)}</ul><form className="admin-inline-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New classification" required disabled={dataUnavailable} /><button className="table-action" type="submit" disabled={dataUnavailable}>Add</button></form></section>
          <section id="admin-roles" className="cms-card"><div className="card-heading"><div><p className="eyebrow">Access model</p><h2>Roles</h2></div></div><div className="role-picker">{roles.map((role) => <button className={role.id === selectedRoleId ? "active" : ""} key={role.id} type="button" onClick={() => { setSelectedRoleId(role.id); setSelectedPermissions(role.permissionIds); }}><strong>{role.name}</strong><small>{role.isLocked ? "Full access" : `${role.permissionIds.length} permissions`}</small></button>)}</div><form className="admin-inline-form" onSubmit={addRole}><input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="New role name" required disabled={dataUnavailable} /><button className="table-action" type="submit" disabled={dataUnavailable}>Create</button></form></section>
        </div>
        <section className="cms-card permissions-panel"><div className="card-heading"><div><p className="eyebrow">Permission module</p><h2>{selectedRole ? `${selectedRole.name} permissions` : "Select a role"}</h2></div></div>{selectedRole?.isLocked ? <p className="panel-copy">The Admin role is locked and always has access to every permission.</p> : <><div className="permission-grid">{permissions.map((permission) => <label className="permission-option" key={permission.id}><input type="checkbox" checked={selectedPermissions.includes(permission.id)} disabled={dataUnavailable} onChange={(event) => setSelectedPermissions((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} /><span>{permission.key}</span>{permission.isLocked && <small>System</small>}</label>)}</div><button className="primary-button" type="button" onClick={savePermissions} disabled={!selectedRoleId || dataUnavailable}>Save permissions</button></>}</section>
        <section id="admin-staff-list" className="cms-card permissions-panel"><div className="card-heading"><div><p className="eyebrow">Staff accounts</p><h2>Staff</h2></div></div>{staffMembers.length === 0 ? <p className="panel-copy">{dataUnavailable ? "Staff accounts could not be loaded." : "No staff accounts yet."}</p> : <ul className="admin-list">{staffMembers.map((member) => <li key={member.id}><div><strong>{member.displayName || member.email}</strong><small>{member.email} · {member.roleName || "No role"} · {member.status === "active" ? "Active" : "Disabled"} · Last sign-in: {formatSignIn(member.lastSignedInAt)}</small></div>{staffEdit?.id === member.id ? <form className="admin-inline-form" onSubmit={(event) => saveStaffEdit(event, member)}><input aria-label={staffEdit.mode === "reset" ? `New temporary password for ${member.email}` : `Display name for ${member.email}`} type={staffEdit.mode === "reset" ? "password" : "text"} autoComplete={staffEdit.mode === "reset" ? "new-password" : "off"} minLength={staffEdit.mode === "reset" ? 12 : 2} placeholder={staffEdit.mode === "reset" ? "Temporary password (12+ characters)" : "Display name"} value={staffEdit.value} onChange={(event) => setStaffEdit({ ...staffEdit, value: event.target.value })} autoFocus required /><button className="table-action" type="submit">Save</button><button className="table-action" type="button" onClick={() => setStaffEdit(null)}>Cancel</button></form> : <span className="admin-row-actions"><button className="table-action" type="button" disabled={dataUnavailable} onClick={() => setStaffEdit({ id: member.id, mode: "rename", value: member.displayName || "" })}>Rename</button>{member.id === currentUserId ? <small className="table-muted">You · change your password from the profile menu</small> : <><button className="table-action" type="button" disabled={dataUnavailable} onClick={() => setStaffEdit({ id: member.id, mode: "reset", value: "" })}>Reset password</button><button className="table-action" type="button" disabled={dataUnavailable} onClick={() => toggleStaffStatus(member)}>{member.status === "active" ? "Disable" : "Enable"}</button></>}</span>}</li>)}</ul>}</section>
        <section id="admin-staff" className="cms-card permissions-panel"><div className="card-heading"><div><p className="eyebrow">Staff accounts</p><h2>Create staff sign-in</h2></div></div><form className="cms-form" onSubmit={addStaff}><label>Display name<input name="displayName" autoComplete="name" value={staff.displayName} onChange={(event) => setStaff({ ...staff, displayName: event.target.value })} required disabled={dataUnavailable} /></label><label>Email address<input name="email" type="email" autoComplete="email" value={staff.email} onChange={(event) => setStaff({ ...staff, email: event.target.value })} required disabled={dataUnavailable} /></label><label>Temporary password<input name="password" type={staffPasswordVisible ? "text" : "password"} autoComplete="new-password" minLength={12} value={staff.password} onChange={(event) => setStaff({ ...staff, password: event.target.value })} required disabled={dataUnavailable} /><span className="admin-row-actions"><button className="table-action" type="button" onClick={generateStaffPassword} disabled={dataUnavailable}>Generate</button>{staff.password && <button className="table-action" type="button" onClick={copyStaffPassword} disabled={dataUnavailable}>Copy</button>}</span></label><label>Role<select name="role" autoComplete="off" value={staff.roleId} onChange={(event) => setStaff({ ...staff, roleId: event.target.value })} required disabled={dataUnavailable || roles.length === 0}><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><button className="primary-button" type="submit" disabled={dataUnavailable || roles.length === 0}>Create staff account</button></form></section>
      </section>
    </StaffShell>
  );
}
