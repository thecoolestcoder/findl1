import React from "react";
import { createRoot } from "react-dom/client";
import FeedbackPage from "./FeedbackPage.jsx";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <FeedbackPage />
  </React.StrictMode>
);
