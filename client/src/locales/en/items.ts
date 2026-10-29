const items = {
  title: "Items",
  description: "Example module with permissions, audit trail and soft delete.",
  create: "Create Item",
  searchPlaceholder: "Search by name",
  showDeleted: "Show deleted",
  empty: "No items.",
  status: {
    all: "All",
    active: "Active",
    archived: "Archived",
  },
  table: {
    name: "Name",
    description: "Description",
    status: "Status",
    createdAt: "Created",
  },
  actions: {
    edit: "Edit",
    delete: "Delete",
    restore: "Restore",
  },
  fields: {
    name: "Name",
    description: "Description",
    status: "Status",
  },
  modals: {
    createTitle: "Create Item",
    editTitle: "Edit Item",
    deleteTitle: "Delete Item",
    deleteContent: 'Delete "{{name}}"? You can restore it later.',
    restoreTitle: "Restore Item",
    restoreContent: 'Restore "{{name}}"?',
  },
  messages: {
    createSuccess: "Item created.",
    updateSuccess: "Item updated.",
    deleteSuccess: "Item deleted.",
    restoreSuccess: "Item restored.",
  },
};

export default items;
