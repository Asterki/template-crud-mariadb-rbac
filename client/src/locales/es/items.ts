const items = {
  title: "Elementos",
  description:
    "Módulo de ejemplo con permisos, auditoría y borrado lógico.",
  create: "Crear Elemento",
  searchPlaceholder: "Buscar por nombre",
  showDeleted: "Mostrar eliminados",
  empty: "No hay elementos.",
  status: {
    all: "Todos",
    active: "Activo",
    archived: "Archivado",
  },
  table: {
    name: "Nombre",
    description: "Descripción",
    status: "Estado",
    createdAt: "Creado",
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
};

export default items;
