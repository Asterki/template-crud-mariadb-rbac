const roles = {
  title: "Roles & Permissions",
  description:
    "Roles and permissions are defined in code. This view is read-only.",
  table: {
    role: "Role",
    permissions: "Permissions",
  },
  names: {
    admin: "Administrator",
    manager: "Manager",
    staff: "Staff",
    viewer: "Viewer",
  },
  permissions: {
    accounts: {
      read: "Read accounts",
      create: "Create accounts",
      update: "Update accounts",
      "update-status": "Update account status",
      "change-password": "Change passwords",
      delete: "Delete accounts",
      restore: "Restore accounts",
    },
    items: {
      read: "Read items",
      create: "Create items",
      update: "Update items",
      delete: "Delete items",
      restore: "Restore items",
    },
    roles: {
      read: "Read roles",
    },
    docs: {
      read: "Read documentation",
    },
  },
};

export default roles;
