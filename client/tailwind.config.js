// Tailwind v4 configuration. The dark variant is declared in index.css with
// @custom-variant; `darkMode` is not a valid nested theme key.
module.exports = {
  theme: {
    extend: {
      keyframes: {
        gradient: {
          "0%": { backgroundPosition: "0% 50%" },
          "25%": { backgroundPosition: "50% 100%" },
          "50%": { backgroundPosition: "100% 50%" },
          "75%": { backgroundPosition: "50% 0%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        gradient: "gradient 6s ease-in-out infinite",
      },

      // Brand colour comes from the ThemeProvider's CSS variable.
      colors: {
        primary: {
          DEFAULT: "var(--brand-primary)",
        },
      },
    },
  },
};
