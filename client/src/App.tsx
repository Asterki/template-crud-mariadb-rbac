import { StrictMode } from "react";
import { Provider } from "react-redux";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { store } from "./store";
import { routeTree } from "./routeTree.gen";
import { Context } from "./Context";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App = () => (
  <StrictMode>
    <Context.Provider value={{ name: "App" }}>
      <Provider store={store}>
        <ThemeProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </ThemeProvider>
      </Provider>
    </Context.Provider>
  </StrictMode>
);

export default App;
