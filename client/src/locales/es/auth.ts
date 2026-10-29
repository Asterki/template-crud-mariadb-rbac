const auth = {
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
    },
  },
  logout: {
    title: "Cerrar Sesión",
    description: "¿Está seguro de que desea cerrar sesión?",
    button: "Cerrar Sesión",
    cancel: "Cancelar",
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
};

export default auth;
