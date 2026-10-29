import { StrictMode, useEffect } from "react";
import { Provider } from "react-redux";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import { store } from "./store";
import { routeTree } from "./routeTree.gen";
import { Context } from "./Context";
import { brand } from "./config/brand";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const App = () => {
  useEffect(() => {
    document.title = brand.name;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", brand.brandColor);
  }, []);

  return (
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
};

export default App;
