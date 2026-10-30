const errors = {
  "404": {
    title: "Página no encontrada",
    description: "La página que busca no existe.",
    back: "Volver al inicio",
  },
  offline: {
    title: "Sin conexión",
    subtitle:
      "No se pudo conectar al servidor. Las funciones que requieren conexión no estarán disponibles.",
    retry: "Reintentar",
  },
  boundary: {
    title: "Algo salió mal",
    description:
      "Se produjo un error inesperado al mostrar esta página. Puede reintentar la operación.",
    retry: "Reintentar",
  },
  codes: {
    unknown: "Se produjo un error inesperado. Intente nuevamente.",
    networkError:
      "No se pudo conectar al servidor. Revise su conexión e intente de nuevo.",
    internalError: "Se produjo un error interno. Intente nuevamente.",
    forbidden: "No tiene permiso para acceder a esta página o acción.",
    unauthorized: "Su sesión expiró. Inicie sesión nuevamente.",
    notFound: "El recurso solicitado no fue encontrado.",
    conflict: "La operación entra en conflicto con el estado actual.",
    validationError: "La solicitud contiene valores no válidos.",
    serviceUnavailable: "El servicio no está disponible en este momento.",
    passwordChangeRequired:
      "Debe cambiar su contraseña antes de continuar.",
    accountNotFound: "La cuenta no fue encontrada.",
    emailInUse: "La dirección de correo ya está en uso.",
    lastAdmin:
      "No se puede eliminar, desactivar o degradar al último administrador.",
    cannotManageSelf:
      "No puede administrar su propia cuenta desde esta sección.",
    cannotManageAccount: "No puede administrar una cuenta con este rol.",
    roleCannotBeAssigned:
      "No puede asignar un rol igual o superior al suyo.",
    invalidCurrentPassword: "La contraseña actual no es correcta.",
    itemNotFound: "El elemento no fue encontrado.",
    invalidOrigin: "El origen de la solicitud no está permitido.",
    invalidOriginSecret: "El origen de la solicitud no está permitido.",
    invalidCsrfToken:
      "El token de seguridad no es válido. Recargue la página.",
    invalidCredentials: "Credenciales inválidas.",
  },
};

export default errors;
