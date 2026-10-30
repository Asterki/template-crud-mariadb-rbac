# Roles and permissions

Roles are fixed by the application code and stored as a Prisma enum. They
cannot be edited from the UI.

| Role | Main capabilities |
|---|---|
| `admin` | Everything, including every permission added later. |
| `manager` | Manage accounts and items below manager rank; read roles and docs. |
| `staff` | Read accounts and roles; create and update items. |
| `viewer` | Read items only. |

## Rules

- A manager can only manage accounts whose role is strictly below manager.
  Managers cannot edit, reset, disable or delete other managers or admins.
- Nobody can manage their own account through the admin endpoints. Use
  **Change password** for your own password.
- The last active admin cannot be deleted, demoted or disabled. Create or
  promote another admin first.
- While an account has a bootstrap password, only the password-change, login,
  logout, CSRF and profile routes work. Change the password first.

## Requesting a change

Ask an admin to change a role in **Accounts**. A new role or permission is a
code change plus a database migration; it is not a runtime setting. See the
developer documentation for the exact files.
