const roles = {
  title: "Roles y Permisos",
  description:
    "Los roles y permisos están definidos en el código. Esta vista es de solo lectura.",
  table: {
    role: "Rol",
    permissions: "Permisos",
  },
  names: {
    admin: "Administrador",
    manager: "Gerente",
    staff: "Colaborador",
    viewer: "Consulta",
  },
  permissions: {
    accounts: {
      read: "Leer cuentas",
      create: "Crear cuentas",
      update: "Actualizar cuentas",
      "update-status": "Actualizar estado de cuentas",
      "change-password": "Cambiar contraseñas",
      delete: "Eliminar cuentas",
      restore: "Restaurar cuentas",
    },
    items: {
      read: "Leer elementos",
      create: "Crear elementos",
      update: "Actualizar elementos",
      delete: "Eliminar elementos",
      restore: "Restaurar elementos",
    },
    roles: {
      read: "Leer roles",
    },
    docs: {
      read: "Leer documentación",
    },
  },
};

export default roles;
