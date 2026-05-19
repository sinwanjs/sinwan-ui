import { cc } from "sinwan/component";
import { defineRoutes, RouterOutlet, setInitialPath } from "./Router.tsx";
import { Home, homeLoader } from "./pages/Home.tsx";
import { About } from "./pages/About.tsx";
import { CounterPage } from "./pages/CounterPage.tsx";

const routes = [
  { path: "/", component: Home, loader: homeLoader },
  { path: "/about", component: About },
  { path: "/counter", component: CounterPage },
];

// Define routes immediately
defineRoutes(routes);

export const App = cc<{ initialPath?: string }>(({ initialPath }) => {
  if (initialPath) {
    setInitialPath(initialPath);
  }

  return (
    <div class="app">
      <RouterOutlet />
    </div>
  );
});
