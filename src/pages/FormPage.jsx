import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const initialForm = {
  nombres: "",
  edad: "",
  cumpleanos: "",
  direccion: "",
  celular: "",
  nombreApoderado: "",
  relacionApoderado: "",
  celularApoderado: "",
};

export default function FormPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.nombres.trim()) e.nombres = "Campo obligatorio";
    if (!form.edad || isNaN(form.edad) || +form.edad < 1 || +form.edad > 120)
      e.edad = "Edad inválida";
    if (!form.cumpleanos) e.cumpleanos = "Selecciona la fecha";
    if (!form.direccion.trim()) e.direccion = "Campo obligatorio";
    if (!/^\d{7,15}$/.test(form.celular.replace(/\s/g, "")))
      e.celular = "Número inválido (7–15 dígitos)";
    if (!form.nombreApoderado.trim()) e.nombreApoderado = "Campo obligatorio";
    if (!form.relacionApoderado) e.relacionApoderado = "Selecciona la relación";
    if (!/^\d{7,15}$/.test(form.celularApoderado.replace(/\s/g, "")))
      e.celularApoderado = "Número inválido (7–15 dígitos)";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    setDbError(null);
    try {
      await addDoc(collection(db, "registros"), {
        nombres:           form.nombres.trim(),
        edad:              parseInt(form.edad),
        cumpleanos:        form.cumpleanos,
        direccion:         form.direccion.trim(),
        celular:           form.celular.trim(),
        nombreApoderado:   form.nombreApoderado.trim(),
        relacionApoderado: form.relacionApoderado,
        celularApoderado:  form.celularApoderado.trim(),
        creadoEn:          serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setDbError("Error al guardar. Verifica tu configuración de Firebase.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="form-page">
        <div className="card success-card">
          <div className="check-wrap">
            <div className="check-ring" />
            <span className="check-icon">✓</span>
          </div>
          <h2 className="success-title">¡Registro exitoso!</h2>
          <p className="success-sub">La información fue guardada en Firebase.</p>
          <div className="summary">
            {[
              ["Nombre completo", form.nombres],
              ["Edad", `${form.edad} años`],
              ["Cumpleaños", form.cumpleanos],
              ["Dirección", form.direccion],
              ["Celular", form.celular],
              ["Apoderado", `${form.nombreApoderado} — ${form.relacionApoderado}`],
              ["Celular apoderado", form.celularApoderado],
            ].map(([lbl, val]) => (
              <div className="summary-row" key={lbl}>
                <span className="summary-label">{lbl}</span>
                <span className="summary-value">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="card">
        <div className="card-header">
          <span className="header-tag">Scout</span>
          <h1 className="header-title">Información para el registro de comunidad</h1>
          <p className="header-sub">Completa todos los campos para registrarte</p>
        </div>

        <form className="form-area" onSubmit={handleSubmit} noValidate>
          <div className="section-title"><span className="section-icon">👤</span> Datos Personales</div>

          <F label="Nombres y Apellidos" err={errors.nombres}>
            <input name="nombres" value={form.nombres} onChange={handleChange}
              placeholder="Ej: María García López" className={`inp ${errors.nombres ? "inp-err" : ""}`} />
          </F>

          <div className="two-col">
            <F label="Edad" err={errors.edad}>
              <input name="edad" type="text" inputMode="numeric" pattern="[0-9]*"
                value={form.edad} onChange={handleChange}
                placeholder="Ej: 15" className={`inp ${errors.edad ? "inp-err" : ""}`} />
            </F>
            <F label="Fecha de Cumpleaños" err={errors.cumpleanos}>
              <input name="cumpleanos" type="date" value={form.cumpleanos} onChange={handleChange}
                className={`inp ${errors.cumpleanos ? "inp-err" : ""}`} />
            </F>
          </div>

          <div className="section-divider" />
          <div className="section-title"><span className="section-icon">📍</span> Contacto y Ubicación</div>

          <F label="Dirección" err={errors.direccion}>
            <input name="direccion" value={form.direccion} onChange={handleChange}
              placeholder="Ej: Av. Primavera 123, Lima" className={`inp ${errors.direccion ? "inp-err" : ""}`} />
          </F>
          <F label="Número de Celular" err={errors.celular}>
            <input name="celular" type="tel" value={form.celular} onChange={handleChange}
              placeholder="Ej: 987 654 321" className={`inp ${errors.celular ? "inp-err" : ""}`} />
          </F>

          <div className="section-divider" />
          <div className="section-title"><span className="section-icon">👨‍👩‍👧</span> Datos del Apoderado</div>

          <F label="Nombre del Padre, Madre o Apoderado" err={errors.nombreApoderado}>
            <input name="nombreApoderado" value={form.nombreApoderado} onChange={handleChange}
              placeholder="Ej: Carlos García" className={`inp ${errors.nombreApoderado ? "inp-err" : ""}`} />
          </F>

          <div className="two-col">
            <F label="Relación con el menor" err={errors.relacionApoderado}>
              <select name="relacionApoderado" value={form.relacionApoderado} onChange={handleChange}
                className={`inp ${errors.relacionApoderado ? "inp-err" : ""}`}>
                <option value="">Seleccionar...</option>
                <option value="Padre">Padre</option>
                <option value="Madre">Madre</option>
                <option value="Apoderado">Apoderado</option>
                <option value="Tutor Legal">Tutor Legal</option>
                <option value="Otro">Otro</option>
              </select>
            </F>
            <F label="Celular del Apoderado" err={errors.celularApoderado}>
              <input name="celularApoderado" type="tel" value={form.celularApoderado} onChange={handleChange}
                placeholder="Ej: 987 654 321" className={`inp ${errors.celularApoderado ? "inp-err" : ""}`} />
            </F>
          </div>

          {dbError && <div className="db-error">{dbError}</div>}

          <button type="submit" className="btn-submit full-width" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? "Guardando..." : "Registrar ✓"}
          </button>
        </form>
      </div>
    </div>
  );
}

function F({ label, err, children }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      {children}
      {err && <span className="field-err">{err}</span>}
    </div>
  );
}
