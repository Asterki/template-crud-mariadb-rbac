const auth = {
  login: {
    title: "Sign in",
    description: "Enter your credentials to continue.",
    fields: {
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      passwordPlaceholder: "Enter your password",
    },
    submit: "Sign in",
    messages: {
      success: "Signed in successfully.",
    },
  },
  logout: {
    title: "Sign out",
    description: "Are you sure you want to sign out?",
    button: "Sign out",
    cancel: "Cancel",
  },
  changePassword: {
    title: "Change Password",
    description: "Update the password for your own account.",
    forcedTitle: "Password change required",
    forcedDescription:
      "You must change the initial password before using the rest of the system.",
    fields: {
      currentPassword: "Current password",
      newPassword: "New password (at least 12 characters)",
      confirmPassword: "Confirm new password",
    },
    messages: {
      success: "Password updated.",
      mismatch: "The passwords do not match.",
    },
  },
};

export default auth;
