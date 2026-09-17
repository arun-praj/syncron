import { createRoot } from "react-dom/client";

import "@/src/styles/app.css";

import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(<App />);
