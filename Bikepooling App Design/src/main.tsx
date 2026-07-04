
  import { createRoot } from "react-dom/client";
  import "./lib/aws-config"; // ← Initialize Amplify before anything else
  import App from "./app/App.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  