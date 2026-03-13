import { Routes, Route } from "react-router-dom";
import "./App.css";
import FormPage from "./pages/FormPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FormPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
