import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import {
  collection, getDocs, onSnapshot, orderBy, query,
  deleteDoc, doc, addDoc, updateDoc, serverTimestamp, where
} from "firebase/firestore";

const ADMIN_USER   = import.meta.env.VITE_ADMIN_USER   || "admin";
const ADMIN_PASS   = import.meta.env.VITE_ADMIN_PASS   || "scout2024";
const ADMIN_NOMBRE = import.meta.env.VITE_ADMIN_NOMBRE || "Super Admin";

const hashPassword = async (pass) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pass));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
};

/* ── Root ── */
export default function AdminPage() {
  const [authed, setAuthed]       = useState(() => sessionStorage.getItem("scout_admin") === "1");
  const [isSuperAdmin, setSuper]  = useState(() => sessionStorage.getItem("scout_super") === "1");
  const [username, setUsername]   = useState(() => sessionStorage.getItem("scout_username") || "");
  const [section, setSection]     = useState("registros");
  const [collapsed, setCollapsed] = useState(true);

  const handleLogin = (superAdmin, nombre) => {
    sessionStorage.setItem("scout_admin",    "1");
    sessionStorage.setItem("scout_super",    superAdmin ? "1" : "0");
    sessionStorage.setItem("scout_username", nombre);
    setAuthed(true); setSuper(superAdmin); setUsername(nombre);
    setCollapsed(true); // siempre oculta al iniciar sesión
  };

  const handleLogout = () => {
    sessionStorage.removeItem("scout_admin");
    sessionStorage.removeItem("scout_super");
    sessionStorage.removeItem("scout_username");
    setAuthed(false); setSuper(false); setUsername(""); setSection("registros");
  };

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
        <button className="sidebar-toggle" onClick={() => setCollapsed(v => !v)}
          title={collapsed ? "Expandir" : "Colapsar"}>
          {collapsed ? "›" : "‹"}
        </button>

        <div className="admin-sidebar-top">
          <div className="sidebar-brand">
            <img src="/favicon.png" alt="Scout" className="sidebar-brand-logo" />
            {!collapsed && (
              <div className="sidebar-brand-text">
                <span className="sidebar-brand-title">{username || "Admin"}</span>
                <span className="sidebar-brand-sub">{isSuperAdmin ? "Super Admin" : "Administrador"}</span>
              </div>
            )}
            {!collapsed && (
              <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">⏻</button>
            )}
          </div>

          <nav className="admin-nav">
            <button className={`admin-nav-item ${section === "registros" ? "active" : ""}`}
              onClick={() => setSection("registros")} title="Registros">
              <span className="nav-icon">📋</span>
              {!collapsed && <span>Registros</span>}
            </button>
            <button className={`admin-nav-item ${section === "nuevo" ? "active" : ""}`}
              onClick={() => setSection("nuevo")} title="Nuevo Scout">
              <span className="nav-icon">➕</span>
              {!collapsed && <span>Nuevo scout</span>}
            </button>
            {isSuperAdmin && (
              <button className={`admin-nav-item ${section === "usuarios" ? "active" : ""}`}
                onClick={() => setSection("usuarios")} title="Usuarios admin">
                <span className="nav-icon">👥</span>
                {!collapsed && <span>Usuarios admin</span>}
              </button>
            )}
            {isSuperAdmin && (
              <button className={`admin-nav-item ${section === "logs" ? "active" : ""}`}
                onClick={() => setSection("logs")} title="Historial de descargas">
                <span className="nav-icon">🕵️</span>
                {!collapsed && <span>Historial descargas</span>}
              </button>
            )}
            {collapsed && (
              <button className="admin-nav-item" onClick={handleLogout} title="Cerrar sesión">
                <span className="nav-icon">⏻</span>
              </button>
            )}
          </nav>
        </div>
      </aside>

      <div className="admin-main">
        {section === "registros" && <RegistrosPanel username={username} isSuperAdmin={isSuperAdmin} />}
        {section === "nuevo"     && <NuevoScoutPanel onSaved={() => setSection("registros")} />}
        {section === "usuarios"  && isSuperAdmin && <UsuariosPanel />}
        {section === "logs"      && isSuperAdmin && <LogsPanel />}
      </div>
    </div>
  );
}

/* ── Login ── */
function LoginScreen({ onLogin }) {
  const [user, setUser]       = useState("");
  const [pass, setPass]       = useState("");
  const [showPass, setShowP]  = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shake = (msg) => { setError(msg); setShaking(true); setTimeout(() => setShaking(false), 500); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user.trim() || !pass) return shake("Completa todos los campos");
    setLoading(true);
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      onLogin(true, ADMIN_NOMBRE); return;
    }
    try {
      const hashed = await hashPassword(pass);
      const snap = await getDocs(query(collection(db, "admins"), where("usuario", "==", user.trim().toLowerCase())));
      if (!snap.empty && snap.docs[0].data().password === hashed) {
        const data = snap.docs[0].data();
        onLogin(data.superAdmin === true, data.nombre);
      } else {
        shake("Usuario o contraseña incorrectos");
      }
    } catch (err) { console.error(err); shake("Error de conexión."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className={`login-card ${shaking ? "shake" : ""}`}>
        <div className="login-top">
          <img src="/favicon.png" alt="Scout" className="login-logo" />
          <h1 className="login-title">Panel de Administración</h1>
          <p className="login-sub">Ingresa tus credenciales para continuar</p>
        </div>
        <form onSubmit={handleSubmit} noValidate className="login-form">
          <div className="field-wrap">
            <label className="field-label">Usuario</label>
            <input className={`inp ${error ? "inp-err" : ""}`} type="text"
              autoComplete="username" placeholder="Tu usuario"
              value={user} onChange={e => { setUser(e.target.value); setError(""); }} />
          </div>
          <div className="field-wrap">
            <label className="field-label">Contraseña</label>
            <div className="pass-wrap">
              <input className={`inp ${error ? "inp-err" : ""}`}
                type={showPass ? "text" : "password"}
                autoComplete="current-password" placeholder="Tu contraseña"
                value={pass} onChange={e => { setPass(e.target.value); setError(""); }} />
              <button type="button" className="pass-toggle" onClick={() => setShowP(v => !v)}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn-submit full-width" style={{marginTop:"1.2rem"}} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? "Verificando..." : "Ingresar →"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Nuevo Scout Panel ── */
function NuevoScoutPanel({ onSaved }) {
  const initialForm = {
    nombres:"", edad:"", cumpleanos:"", direccion:"",
    celular:"", nombreApoderado:"", relacionApoderado:"", celularApoderado:"",
  };
  const [form, setForm]       = useState(initialForm);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({...p, [name]: value}));
    if (errors[name]) setErrors(p => ({...p, [name]: ""}));
  };

  const validate = () => {
    const e = {};
    if (!form.nombres.trim()) e.nombres = "Campo obligatorio";
    if (!form.edad || isNaN(form.edad) || +form.edad < 1 || +form.edad > 120) e.edad = "Edad inválida";
    if (!form.cumpleanos) e.cumpleanos = "Selecciona la fecha";
    if (!form.direccion.trim()) e.direccion = "Campo obligatorio";
    if (!/^\d{7,15}$/.test(form.celular.replace(/\s/g,""))) e.celular = "Número inválido (7–15 dígitos)";
    if (!form.nombreApoderado.trim()) e.nombreApoderado = "Campo obligatorio";
    if (!form.relacionApoderado) e.relacionApoderado = "Selecciona la relación";
    if (!/^\d{7,15}$/.test(form.celularApoderado.replace(/\s/g,""))) e.celularApoderado = "Número inválido (7–15 dígitos)";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true); setDbError(null);

    // Optimistic UI: mostrar éxito inmediatamente sin esperar a Firestore
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setForm(initialForm); onSaved(); }, 1500);

    // Guardar en Firestore en segundo plano
    addDoc(collection(db, "registros"), {
      nombres: form.nombres.trim(), edad: parseInt(form.edad),
      cumpleanos: form.cumpleanos, direccion: form.direccion.trim(),
      celular: form.celular.trim(), nombreApoderado: form.nombreApoderado.trim(),
      relacionApoderado: form.relacionApoderado, celularApoderado: form.celularApoderado.trim(),
      creadoEn: serverTimestamp(),
    }).catch(err => { console.error("Error guardando registro:", err); });

    setLoading(false);
  };

  if (success) return (
    <div className="nuevo-scout-page">
      <div className="nuevo-success">
        <div className="check-wrap"><div className="check-ring"/><span className="check-icon">✓</span></div>
        <h2 style={{fontFamily:"Fraunces,serif", color:"var(--forest)"}}>¡Scout registrado!</h2>
        <p style={{color:"var(--muted)", fontSize:"0.85rem"}}>Redirigiendo a la lista...</p>
      </div>
    </div>
  );

  return (
    <div className="nuevo-scout-page">
      <div className="nuevo-scout-card">
        <div className="card-header">
          <span className="header-tag">Admin</span>
          <h1 className="header-title">Nuevo registro de scout</h1>
          <p className="header-sub">Agrega manualmente un nuevo miembro</p>
        </div>
        <form className="form-area" onSubmit={handleSubmit} noValidate>
          <div className="section-title"><span className="section-icon">👤</span> Datos Personales</div>
          <F label="Nombres y Apellidos" err={errors.nombres}>
            <input name="nombres" value={form.nombres} onChange={handleChange}
              placeholder="Ej: María García López" className={`inp ${errors.nombres ? "inp-err" : ""}`} />
          </F>
          <div className="two-col">
            <F label="Edad" err={errors.edad}>
              <input name="edad" type="text" inputMode="numeric" value={form.edad} onChange={handleChange}
                placeholder="Ej: 15" className={`inp ${errors.edad ? "inp-err" : ""}`} />
            </F>
            <F label="Fecha de Cumpleaños" err={errors.cumpleanos}>
              <input name="cumpleanos" type="date" value={form.cumpleanos} onChange={handleChange}
                className={`inp ${errors.cumpleanos ? "inp-err" : ""}`} />
            </F>
          </div>
          <div className="section-divider"/>
          <div className="section-title"><span className="section-icon">📍</span> Contacto y Ubicación</div>
          <F label="Dirección" err={errors.direccion}>
            <input name="direccion" value={form.direccion} onChange={handleChange}
              placeholder="Ej: Av. Primavera 123, Lima" className={`inp ${errors.direccion ? "inp-err" : ""}`} />
          </F>
          <F label="Número de Celular" err={errors.celular}>
            <input name="celular" type="tel" value={form.celular} onChange={handleChange}
              placeholder="Ej: 987 654 321" className={`inp ${errors.celular ? "inp-err" : ""}`} />
          </F>
          <div className="section-divider"/>
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
                <option>Padre</option><option>Madre</option>
                <option>Apoderado</option><option>Tutor Legal</option><option>Otro</option>
              </select>
            </F>
            <F label="Celular del Apoderado" err={errors.celularApoderado}>
              <input name="celularApoderado" type="tel" value={form.celularApoderado} onChange={handleChange}
                placeholder="Ej: 987 654 321" className={`inp ${errors.celularApoderado ? "inp-err" : ""}`} />
            </F>
          </div>
          {dbError && <div className="db-error">{dbError}</div>}
          <button type="submit" className="btn-submit full-width" disabled={loading}>
            {loading && <span className="spinner"/>}
            {loading ? "Guardando..." : "Registrar scout ✓"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Export helpers ── */
function exportarPDF(registros) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Registros de Scouts", 14, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el ${new Date().toLocaleDateString("es-PE", {day:"2-digit",month:"long",year:"numeric"})}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["Nombre", "Edad", "Cumpleaños", "Dirección", "Celular", "Apoderado", "Relación", "Cel. Apoderado"]],
    body: registros.map(r => [
      r.nombres || "", r.edad || "", r.cumpleanos || "",
      r.direccion || "", r.celular || "",
      r.nombreApoderado || "", r.relacionApoderado || "", r.celularApoderado || ""
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [45, 74, 62], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 240, 232] },
    columnStyles: { 3: { cellWidth: 45 } },
  });
  doc.save("registros-scouts.pdf");
}

function exportarExcel(registros) {
  const data = registros.map((r, i) => ({
    "#": i + 1,
    "Nombres y Apellidos": r.nombres || "",
    "Edad": r.edad || "",
    "Fecha de Cumpleaños": r.cumpleanos || "",
    "Dirección": r.direccion || "",
    "Celular": r.celular || "",
    "Nombre Apoderado": r.nombreApoderado || "",
    "Relación": r.relacionApoderado || "",
    "Celular Apoderado": r.celularApoderado || "",
    "Fecha de Registro": r.creadoEn?.toDate
      ? r.creadoEn.toDate().toLocaleDateString("es-PE")
      : "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    {wch:4},{wch:30},{wch:6},{wch:18},{wch:35},
    {wch:14},{wch:28},{wch:14},{wch:16},{wch:18}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Registros");
  XLSX.writeFile(wb, "registros-scouts.xlsx");
}

/* ── Registros Panel ── */
function RegistrosPanel({ username, isSuperAdmin }) {
  const [registros, setRegistros]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [confirmDelete, setConfirm] = useState(null);
  const [mobileView, setMobile]     = useState("list");
  const [showExport, setShowExport] = useState(false);

  const fetchRegistros = () => {
    setLoading(true); setError(null);
    // onSnapshot sirve datos desde caché local instantáneamente,
    // luego actualiza cuando llegan datos frescos del servidor
    const q = query(collection(db, "registros"), orderBy("creadoEn", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setRegistros(snap.docs.map(d => ({id: d.id, ...d.data()})));
        setLoading(false);
      },
      (err) => { console.error(err); setError("No se pudieron cargar los registros."); setLoading(false); }
    );
    return unsub;
  };

  useEffect(() => {
    const unsub = fetchRegistros();
    return () => unsub && unsub(); // cleanup al desmontar
  }, []);

  const handleDelete = async (id) => {
    setDeleting(id);
    // Optimistic delete: quitar de UI al instante
    const prev = registros;
    setRegistros(p => p.filter(r => r.id !== id));
    if (selected?.id === id) { setSelected(null); setMobile("list"); }
    setDeleting(null); setConfirm(null);
    // Borrar en Firestore en segundo plano
    deleteDoc(doc(db, "registros", id)).catch(err => {
      console.error(err);
      setRegistros(prev); // revertir si falla
    });
  };

  const filtered = registros.filter(r =>
    r.nombres?.toLowerCase().includes(search.toLowerCase()) ||
    r.celular?.includes(search) ||
    r.direccion?.toLowerCase().includes(search.toLowerCase()) ||
    r.nombreApoderado?.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-PE", {day:"2-digit", month:"short", year:"numeric"});
  };

  return (
    <div className="panel-layout">
      <div className={`panel-list ${mobileView === "detail" ? "mobile-hidden" : ""}`}>
        <div className="panel-list-top">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-inp" placeholder="Buscar..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
          </div>
          <div className="list-meta">
            <span>{loading ? "Cargando..." : `${filtered.length} registro${filtered.length !== 1 ? "s" : ""}`}</span>
            <div style={{display:"flex",gap:"4px"}}>
              <button className="refresh-btn" onClick={fetchRegistros} title="Actualizar">↺</button>
              <button className="export-btn" onClick={() => setShowExport(true)} title="Descargar registros" disabled={loading || registros.length === 0}>⬇</button>
            </div>
          </div>
        </div>
        <div className="list">
          {loading && [1,2,3,4,5].map(i => <div key={i} className="skeleton"/>)}
          {!loading && error && <div className="list-error">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="list-empty">{search ? "Sin resultados." : "No hay registros aún."}</div>
          )}
          {!loading && filtered.map(r => (
            <button key={r.id} className={`list-item ${selected?.id === r.id ? "active" : ""}`}
              onClick={() => { setSelected(r); setMobile("detail"); }}>
              <div className="list-avatar">{r.nombres?.[0]?.toUpperCase() || "?"}</div>
              <div className="list-info">
                <span className="list-name">{r.nombres}</span>
                <span className="list-age">{r.edad} años · {fmtDate(r.creadoEn)}</span>
              </div>
              <span className="list-arrow">›</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`panel-detail ${mobileView === "list" ? "mobile-hidden" : ""}`}>
        {mobileView === "detail" && (
          <button className="back-btn" onClick={() => setMobile("list")}>← Volver</button>
        )}
        {!selected ? (
          <div className="detail-empty">
            <div className="detail-empty-icon">📋</div>
            <p>Selecciona un registro para ver sus detalles</p>
          </div>
        ) : (
          <div className="detail-card" key={selected.id}>
            <div className="detail-header">
              <div className="detail-avatar">{selected.nombres?.[0]?.toUpperCase()}</div>
              <div className="detail-header-info">
                <h2 className="detail-name">{selected.nombres}</h2>
                <span className="detail-badge">Registrado el {fmtDate(selected.creadoEn)}</span>
              </div>
              <button className="delete-btn" onClick={() => setConfirm(selected)}>🗑️</button>
            </div>
            <div className="detail-sections">
              <Section title="👤 Datos Personales">
                <Row label="Nombre completo" value={selected.nombres}/>
                <Row label="Edad" value={`${selected.edad} años`}/>
                <Row label="Cumpleaños" value={selected.cumpleanos}/>
              </Section>
              <Section title="📍 Contacto y Ubicación">
                <Row label="Dirección" value={selected.direccion}/>
                <Row label="Celular" value={selected.celular} phone/>
              </Section>
              <Section title="👨‍👩‍👧 Apoderado">
                <Row label="Nombre" value={selected.nombreApoderado}/>
                <Row label="Relación" value={selected.relacionApoderado}/>
                <Row label="Celular" value={selected.celularApoderado} phone/>
              </Section>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">¿Eliminar registro?</h3>
            <p className="modal-sub">Se eliminará permanentemente el registro de <strong>{confirmDelete.nombres}</strong>.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="modal-confirm" disabled={deleting === confirmDelete.id}
                onClick={() => handleDelete(confirmDelete.id)}>
                {deleting === confirmDelete.id ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <ExportModal
          registros={filtered.length > 0 ? filtered : registros}
          count={filtered.length > 0 ? filtered.length : registros.length}
          isFiltered={search.length > 0}
          searchTerm={search}
          username={username}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

/* ── Export Modal ── */
function ExportModal({ registros, count, isFiltered, searchTerm, username, onClose }) {
  const [format, setFormat] = useState("pdf");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (format === "pdf") exportarPDF(registros);
      else exportarExcel(registros);
      // Save audit log
      await addDoc(collection(db, "logs_descarga"), {
        usuario:     username || "desconocido",
        formato:     format.toUpperCase(),
        totalRegistros: count,
        filtrado:    isFiltered,
        filtroBusqueda: searchTerm || "",
        fecha:       serverTimestamp(),
      });
    } catch (err) { console.error("Error al guardar log:", err); }
    finally {
      setDownloading(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-export" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">📥</div>
        <h3 className="modal-title">Descargar registros</h3>
        <p className="modal-sub">
          Se exportarán <strong>{count} registro{count !== 1 ? "s" : ""}</strong>
          {isFiltered ? " (filtrados por búsqueda)" : " en total"}.
        </p>

        <div className="export-format-selector">
          <button
            className={`export-format-btn ${format === "pdf" ? "active" : ""}`}
            onClick={() => setFormat("pdf")}
          >
            <span className="export-format-icon">📄</span>
            <span className="export-format-label">PDF</span>
            <span className="export-format-sub">Tabla formateada</span>
          </button>
          <button
            className={`export-format-btn ${format === "excel" ? "active" : ""}`}
            onClick={() => setFormat("excel")}
          >
            <span className="export-format-icon">📊</span>
            <span className="export-format-label">Excel</span>
            <span className="export-format-sub">Hoja de cálculo .xlsx</span>
          </button>
        </div>

        <div className="modal-actions" style={{marginTop:"1.2rem"}}>
          <button className="modal-cancel" onClick={onClose}>Cancelar</button>
          <button className="modal-confirm" onClick={handleDownload} disabled={downloading}
            style={{background: format === "pdf" ? "#c0392b" : "#1e7e34"}}>
            {downloading && <span className="spinner"/>}
            {downloading ? "Generando..." : `Descargar ${format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Usuarios Panel ── */
function UsuariosPanel() {
  const [admins, setAdmins]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [confirmDelete, setConfirm] = useState(null);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "admins"), orderBy("creadoEn", "desc")));
      setAdmins(snap.docs.map(d => ({id: d.id, ...d.data()})));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "admins", id));
      setAdmins(p => p.filter(a => a.id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); setConfirm(null); }
  };

  const fmtDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-PE", {day:"2-digit", month:"short", year:"numeric"});
  };

  return (
    <div className="usuarios-panel">
      <div className="usuarios-header">
        <div>
          <h2 className="usuarios-title">Usuarios Administradores</h2>
          <p className="usuarios-sub">Gestiona quién puede acceder al panel</p>
        </div>
        <button className="btn-submit" onClick={() => setShowNew(true)}>+ Nuevo admin</button>
      </div>

      {loading && <div className="list-empty">Cargando usuarios...</div>}
      {!loading && admins.length === 0 && (
        <div className="usuarios-empty"><span>👥</span><p>No hay usuarios administradores creados aún.</p></div>
      )}
      {!loading && admins.length > 0 && (
        <div className="usuarios-list">
          {admins.map(a => (
            <div className="usuario-card" key={a.id}>
              <div className="usuario-avatar">{a.nombre?.[0]?.toUpperCase() || "A"}</div>
              <div className="usuario-info">
                <span className="usuario-nombre">{a.nombre}</span>
                <span className="usuario-usuario">@{a.usuario}</span>
              </div>
              {a.superAdmin && <span className="badge-super">Super Admin</span>}
              <span className="usuario-fecha">{fmtDate(a.creadoEn)}</span>
              <button className="edit-btn" onClick={() => setEditTarget(a)} title="Editar">✏️</button>
              <button className="delete-btn" onClick={() => setConfirm(a)} title="Eliminar">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <AdminFormModal
          mode="create"
          onClose={() => setShowNew(false)}
          onDone={() => { setShowNew(false); fetchAdmins(); }}
        />
      )}

      {editTarget && (
        <AdminFormModal
          mode="edit"
          admin={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={() => { setEditTarget(null); fetchAdmins(); }}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">¿Eliminar usuario?</h3>
            <p className="modal-sub">Se eliminará la cuenta de <strong>@{confirmDelete.usuario}</strong>.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="modal-confirm" disabled={deleting === confirmDelete.id}
                onClick={() => handleDelete(confirmDelete.id)}>
                {deleting === confirmDelete.id ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Admin Form Modal (create + edit) ── */
function AdminFormModal({ mode, admin, onClose, onDone }) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState({
    nombre:     isEdit ? admin.nombre    : "",
    usuario:    isEdit ? admin.usuario   : "",
    pass:       "",
    confirm:    "",
    superAdmin: isEdit ? (admin.superAdmin === true) : false,
  });
  const [showPass, setShowP]  = useState(false);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => { setForm(p => ({...p, [k]: v})); if (errors[k]) setErrors(p => ({...p, [k]: ""})); };

  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Campo obligatorio";
    if (!form.usuario.trim() || form.usuario.trim().length < 3) e.usuario = "Mínimo 3 caracteres";
    if (!isEdit) {
      if (form.pass.length < 6) e.pass = "Mínimo 6 caracteres";
      if (form.pass !== form.confirm) e.confirm = "Las contraseñas no coinciden";
    } else if (form.pass) {
      if (form.pass.length < 6) e.pass = "Mínimo 6 caracteres";
      if (form.pass !== form.confirm) e.confirm = "Las contraseñas no coinciden";
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) return setErrors(errs);
    setLoading(true);
    try {
      const usuarioNorm = form.usuario.trim().toLowerCase();

      if (isEdit) {
        const updates = {
          nombre:     form.nombre.trim(),
          usuario:    usuarioNorm,
          superAdmin: form.superAdmin,
        };
        if (form.pass) updates.password = await hashPassword(form.pass);
        await updateDoc(doc(db, "admins", admin.id), updates);
      } else {
        const existing = await getDocs(query(collection(db, "admins"), where("usuario", "==", usuarioNorm)));
        if (!existing.empty) { setErrors({usuario: "Ese usuario ya existe"}); setLoading(false); return; }
        const hashed = await hashPassword(form.pass);
        await addDoc(collection(db, "admins"), {
          nombre: form.nombre.trim(), usuario: usuarioNorm,
          password: hashed, superAdmin: form.superAdmin, creadoEn: serverTimestamp(),
        });
      }
      onDone();
    } catch (err) {
      console.error(err);
      setErrors({general: "Error al guardar. Intenta de nuevo."});
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-form" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title" style={{textAlign:"left", marginBottom:"0.25rem"}}>
          {isEdit ? "Editar administrador" : "Nuevo administrador"}
        </h3>
        <p className="modal-sub" style={{textAlign:"left", marginBottom:"1.2rem"}}>
          {isEdit ? "Modifica los datos del administrador. Deja la contraseña en blanco para no cambiarla." : "El nuevo usuario podrá acceder al panel admin."}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <F label="Nombre completo" err={errors.nombre}>
            <input className={`inp ${errors.nombre ? "inp-err" : ""}`} type="text"
              placeholder="Ej: Ana Torres" value={form.nombre}
              onChange={e => set("nombre", e.target.value)} />
          </F>
          <F label="Usuario" err={errors.usuario}>
            <input className={`inp ${errors.usuario ? "inp-err" : ""}`} type="text"
              placeholder="Ej: anascout" autoComplete="off" value={form.usuario}
              onChange={e => set("usuario", e.target.value)} />
          </F>
          <F label={isEdit ? "Nueva contraseña (opcional)" : "Contraseña"} err={errors.pass}>
            <div className="pass-wrap">
              <input className={`inp ${errors.pass ? "inp-err" : ""}`}
                type={showPass ? "text" : "password"}
                placeholder={isEdit ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"}
                value={form.pass} onChange={e => set("pass", e.target.value)} />
              <button type="button" className="pass-toggle" onClick={() => setShowP(v => !v)}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </F>
          {(!isEdit || form.pass) && (
            <F label="Confirmar contraseña" err={errors.confirm}>
              <input className={`inp ${errors.confirm ? "inp-err" : ""}`}
                type={showPass ? "text" : "password"} placeholder="Repite la contraseña"
                value={form.confirm} onChange={e => set("confirm", e.target.value)} />
            </F>
          )}

          <div className="super-toggle-wrap">
            <label className="super-toggle-label">
              <div className={`super-toggle ${form.superAdmin ? "on" : ""}`}
                onClick={() => set("superAdmin", !form.superAdmin)}>
                <div className="super-toggle-knob"/>
              </div>
              <div>
                <span className="super-toggle-title">Super Administrador</span>
                <span className="super-toggle-sub">Puede gestionar otros usuarios admin</span>
              </div>
            </label>
          </div>

          {errors.general && <div className="login-error">{errors.general}</div>}

          <div className="modal-actions" style={{marginTop:"1.2rem"}}>
            <button type="button" className="modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="modal-confirm" style={{background:"var(--forest)"}} disabled={loading}>
              {loading && <span className="spinner"/>}
              {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Logs Panel ── */
function LogsPanel() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "logs_descarga"), orderBy("fecha", "desc")));
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const fmtDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-PE", { day:"2-digit", month:"short", year:"numeric" })
      + " " + d.toLocaleTimeString("es-PE", { hour:"2-digit", minute:"2-digit" });
  };

  const fmtBadge = (fmt) => {
    if (fmt === "PDF")   return <span className="log-badge log-pdf">PDF</span>;
    if (fmt === "EXCEL") return <span className="log-badge log-excel">Excel</span>;
    return <span className="log-badge">{fmt}</span>;
  };

  return (
    <div className="usuarios-panel">
      <div className="usuarios-header">
        <div>
          <h2 className="usuarios-title">Historial de descargas</h2>
          <p className="usuarios-sub">Registro de quién descargó los datos de scouts y cuándo</p>
        </div>
        <button className="refresh-btn" style={{width:32,height:32,borderRadius:8}} onClick={fetchLogs}>↺</button>
      </div>

      {loading && <div className="list-empty">Cargando historial...</div>}
      {!loading && logs.length === 0 && (
        <div className="usuarios-empty"><span>🕵️</span><p>No hay descargas registradas aún.</p></div>
      )}
      {!loading && logs.length > 0 && (
        <div className="logs-list">
          {logs.map(l => (
            <div className="log-card" key={l.id}>
              <div className="log-avatar">{l.usuario?.[0]?.toUpperCase() || "?"}</div>
              <div className="log-info">
                <div className="log-user-row">
                  <span className="log-usuario">{l.usuario}</span>
                  {fmtBadge(l.formato)}
                  <span className="log-count">{l.totalRegistros} registro{l.totalRegistros !== 1 ? "s" : ""}</span>
                  {l.filtrado && (
                    <span className="log-filtro" title={`Búsqueda: "${l.filtroBusqueda}"`}>
                      🔍 filtrado
                    </span>
                  )}
                </div>
                <span className="log-fecha">{fmtDate(l.fecha)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="d-section">
      <div className="d-section-title">{title}</div>
      <div className="d-rows">{children}</div>
    </div>
  );
}
function Row({ label, value, phone }) {
  return (
    <div className="d-row">
      <span className="d-label">{label}</span>
      {phone ? <a href={`tel:${value}`} className="d-value phone">{value}</a>
              : <span className="d-value">{value || "—"}</span>}
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
