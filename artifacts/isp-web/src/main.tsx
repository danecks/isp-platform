import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installFetchSessionPatch } from "./lib/fetchSessionPatch";
import { bootstrapNative } from "./lib/native/bootstrap";

installFetchSessionPatch();
bootstrapNative();

createRoot(document.getElementById("root")!).render(<App />);
