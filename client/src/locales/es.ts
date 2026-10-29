const translation = {
  "error-messages": {
    "internal-error": "Se produjo un error interno. Intente nuevamente.",
    "network-error":
      "No se pudo conectar al servidor. Revise su conexión e intente de nuevo.",
    forbidden: "No tiene permiso para acceder a esta página o acción.",
    unauthorized: "Su sesión expiró. Inicie sesión nuevamente.",
    "not-found": "El recurso solicitado no fue encontrado.",
    "account-not-found": "La cuenta no fue encontrada.",
    "email-in-use": "La dirección de correo ya está en uso.",
    "last-admin":
      "No se puede eliminar, desactivar o degradar al último administrador.",
    "cannot-manage-self":
      "No puede administrar su propia cuenta desde esta sección.",
    "role-cannot-be-assigned":
      "No puede asignar un rol igual o superior al suyo.",
    "invalid-current-password": "La contraseña actual no es correcta.",
    "password-change-required":
      "Debe cambiar su contraseña antes de continuar.",
    "item-not-found": "El elemento no fue encontrado.",
    "invalid-origin": "El origen de la solicitud no está permitido.",
    "invalid-csrf-token":
      "El token de seguridad no es válido. Recargue la página.",
    "invalid-credentials": "Credenciales inválidas.",
    conflict: "La operación entra en conflicto con el estado actual.",
    "service-unavailable": "El servicio no está disponible en este momento.",
  },

  validation: {
    "invalid-email": "El correo electrónico no es válido.",
    "name-too-short": "El nombre es demasiado corto.",
    "name-too-long": "El nombre es demasiado largo.",
    "password-too-short": "La contraseña debe tener al menos 12 caracteres.",
    "password-too-long": "La contraseña es demasiado larga.",
    "password-required": "La contraseña es obligatoria.",
    "password-unchanged": "La nueva contraseña debe ser diferente a la actual.",
    "invalid-role": "El rol seleccionado no es válido.",
    "no-fields": "No hay cambios para guardar.",
    "invalid-status": "El estado seleccionado no es válido.",
    "query-too-long": "La búsqueda es demasiado larga.",
    "description-too-long": "La descripción es demasiado larga.",
  },

  common: {
    loggedInAs: "Conectado como {{name}} ({{email}})",
    search: "Buscar",
    cancel: "Cancelar",
    yes: "Sí",
    no: "No",
    save: "Guardar",
    create: "Crear",
    confirm: "Confirmar",
    actions: "Acciones",
    loading: "Cargando...",
    retry: "Reintentar",
    theme: {
      toDark: "Cambiar a modo oscuro",
      toLight: "Cambiar a modo claro",
    },
  },

  permissions: {
    "accounts.read": "Leer cuentas",
    "accounts.create": "Crear cuentas",
    "accounts.update": "Actualizar cuentas",
    "accounts.update-status": "Actualizar estado de cuentas",
    "accounts.change-password": "Cambiar contraseñas",
    "accounts.delete": "Eliminar cuentas",
    "accounts.restore": "Restaurar cuentas",
    "items.read": "Leer elementos",
    "items.create": "Crear elementos",
    "items.update": "Actualizar elementos",
    "items.delete": "Eliminar elementos",
    "items.restore": "Restaurar elementos",
    "roles.read": "Leer roles",
    "docs.read": "Leer documentación",
  },

  layouts: {
    admin: {
      sidebar: {
        dashboard: "Panel de Control",
        accounts: "Cuentas de Usuario",
        items: "Elementos",
        roles: "Roles y Permisos",
        changePassword: "Cambiar Contraseña",
        logout: "Cerrar Sesión",
      },
    },
  },

  pages: {
    auth: {
      login: {
        title: "Iniciar Sesión",
        description: "Ingrese sus credenciales para continuar.",
        fields: {
          email: "Correo Electrónico",
          emailPlaceholder: "Ingrese su correo electrónico",
          password: "Contraseña",
          passwordPlaceholder: "Ingrese su contraseña",
        },
        submit: "Iniciar Sesión",
        messages: {
          success: "Inicio de sesión exitoso.",
          "invalid-credentials": "Credenciales inválidas.",
          "invalid-email": "El correo electrónico no es válido.",
          "password-required": "La contraseña es obligatoria.",
          "network-error": "No se pudo conectar al servidor.",
          "account-locked": "La cuenta está inactiva.",
        },
      },
      logout: {
        title: "Cerrar Sesión",
        description: "¿Está seguro de que desea cerrar sesión?",
        button: "Cerrar Sesión",
        cancel: "Cancelar",
        messages: {
          error: "No se pudo cerrar la sesión. Intente nuevamente.",
        },
      },
    },
    admin: {
      index: {
        greetings: {
          morning: "Buenos días",
          afternoon: "Buenas tardes",
          evening: "Buenas noches",
        },
        description: "Bienvenido al panel de administración.",
        items: {
          accounts: {
            title: "Gestión de Cuentas",
            description: "Administre las cuentas y sus roles.",
          },
          roles: {
            title: "Roles y Permisos",
            description: "Consulte el mapa de permisos por rol.",
          },
        },
      },
      accounts: {
        title: "Gestión de Cuentas",
        description: "Administre las cuentas de usuario del sistema.",
        createAccount: "Crear Cuenta",
        searchPlaceholder: "Buscar por nombre o correo",
        showDeleted: "Mostrar eliminadas",
        table: {
          name: "Nombre",
          email: "Correo",
          role: "Rol",
          status: "Estado",
          lastLogin: "Último acceso",
          never: "Nunca",
          actions: "Acciones",
          deleted: "Eliminada",
        },
        actions: {
          edit: "Editar",
          activate: "Activar",
          deactivate: "Desactivar",
          password: "Contraseña",
          restore: "Restaurar",
          delete: "Eliminar",
        },
        fields: {
          name: "Nombre",
          email: "Correo",
          password: "Contraseña inicial",
          newPassword: "Nueva contraseña",
        },
        modals: {
          createTitle: "Crear Cuenta",
          editTitle: "Editar Cuenta",
          passwordTitle: "Restablecer Contraseña",
          statusTitle: "Cambiar Estado",
          statusContent: "¿Cambiar el estado de {{name}} a {{status}}?",
          deleteTitle: "Eliminar Cuenta",
          deleteContent:
            "¿Eliminar la cuenta de {{name}}? El correo se libera para reutilizarlo.",
          restoreTitle: "Restaurar Cuenta",
          restoreContent: "¿Restaurar la cuenta de {{name}}?",
        },
        messages: {
          createSuccess: "Cuenta creada.",
          updateSuccess: "Cuenta actualizada.",
          statusSuccess: "Estado actualizado.",
          passwordSuccess: "Contraseña restablecida.",
          deleteSuccess: "Cuenta eliminada.",
          restoreSuccess: "Cuenta restaurada.",
        },
      },
      items: {
        title: "Elementos",
        description:
          "Módulo de ejemplo con permisos, auditoría y borrado lógico.",
        create: "Crear Elemento",
        searchPlaceholder: "Buscar por nombre",
        showDeleted: "Mostrar eliminados",
        empty: "No hay elementos.",
        table: {
          name: "Nombre",
          description: "Descripción",
          status: "Estado",
          createdAt: "Creado",
        },
        status: {
          all: "Todos",
          active: "Activo",
          archived: "Archivado",
        },
        actions: {
          edit: "Editar",
          delete: "Eliminar",
          restore: "Restaurar",
        },
        fields: {
          name: "Nombre",
          description: "Descripción",
          status: "Estado",
        },
        modals: {
          createTitle: "Crear Elemento",
          editTitle: "Editar Elemento",
          deleteTitle: "Eliminar Elemento",
          deleteContent: '¿Eliminar "{{name}}"? Podrá restaurarlo después.',
          restoreTitle: "Restaurar Elemento",
          restoreContent: '¿Restaurar "{{name}}"?',
        },
        messages: {
          createSuccess: "Elemento creado.",
          updateSuccess: "Elemento actualizado.",
          deleteSuccess: "Elemento eliminado.",
          restoreSuccess: "Elemento restaurado.",
        },
      },
      roles: {
        title: "Roles y Permisos",
        description:
          "Los roles y permisos están definidos en el código. Esta vista es de solo lectura.",
        table: {
          role: "Rol",
          permissions: "Permisos",
        },
      },
      changePassword: {
        title: "Cambiar Contraseña",
        description: "Actualice la contraseña de su propia cuenta.",
        forcedTitle: "Cambio de contraseña obligatorio",
        forcedDescription:
          "Debe cambiar la contraseña inicial antes de usar el resto del sistema.",
        fields: {
          currentPassword: "Contraseña actual",
          newPassword: "Nueva contraseña (mínimo 12 caracteres)",
          confirmPassword: "Confirmar nueva contraseña",
        },
        messages: {
          success: "Contraseña actualizada.",
          mismatch: "Las contraseñas no coinciden.",
        },
      },
    },
  },

  errors: {
    "404": {
      title: "Página no encontrada",
      description: "La página que busca no existe.",
      back: "Volver al inicio",
    },
    boundary: {
      title: "Algo salió mal",
      description:
        "Se produjo un error inesperado al mostrar esta página. Puede reintentar la operación.",
      retry: "Reintentar",
    },
    offline: {
      title: "Sin conexión",
      subtitle:
        "No se pudo conectar al servidor. Las funciones que requieren conexión no estarán disponibles.",
      retry: "Reintentar",
    },
  },
};

export default translation;
