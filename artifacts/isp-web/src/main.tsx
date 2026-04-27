import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchSessionPatch } from "./lib/fetchSessionPatch";

installFetchSessionPatch();

createRoot(document.getElementById("root")!).render(<App />);
