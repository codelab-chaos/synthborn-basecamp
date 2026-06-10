import { createRoot } from "react-dom/client";
import { App } from "./app";
import { SeedRunner } from "./components/seed-runner";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

const seedMode = new URLSearchParams(window.location.search).has("seed");
createRoot(root).render(seedMode ? <SeedRunner /> : <App />);
