'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ReceiptText, FileSpreadsheet, LogOut, 
  User, Lock, CheckCircle2, AlertTriangle, Info, 
  Plus, Edit2, Trash2, Download, XCircle, FileText,
  Users, UserCircle, Settings, Camera, ChevronDown
} from 'lucide-react';

const API_URL = 'https://api.clinicagovision.com';

const EMPRESAS = [
  { razon_social: 'ANTARES HEALTH MANAGEMENT S.R.L.', ruc: '20609478056', direccion: 'Cal. Victor Alzamora 477, Surquillo, Lima' },
  { razon_social: 'VISION MONTECRISTO S.R.L.', ruc: '20601969051', direccion: 'Cal. Emilio Althaus 121 Dpto. 301, Lince, Lima' },
  { razon_social: 'GESTION MEDICA PROXIMA CENTAURI S.R.L.', ruc: '20609526964', direccion: 'Jr. Emilio Althaus 121 Dpto. 301, Lince, Lima' },
  { razon_social: 'CENTRO DE EXCELENCIA EN GLAUCOMA S.R.L.', ruc: '20609414660', direccion: 'Jr. Emilio Althaus 121 Dpto. 901, Lince, Lima' }
];

interface ItemVenta { id: number; producto: string; cantidad: number; precio_unitario: number; total: number; glosa?: string; }
interface TicketHistorial {
  id: number; created_at: string; total_venta: number; estado: string; cliente_data: any; items_data: any;
  base_imponible?: number; igv?: number;
  referencia_data?: { fecha?: string; tipo?: string; serie?: string; numero?: string; };
  filename?: string; referencia_id?: number; anulado?: boolean; ticket_origen?: string; nro_ticket?: string;
}

// Nueva interfaz para los datos de usuario
interface UserData {
  id: number; username: string; nombre_completo: string; role: string; edad: number; foto?: string;
}

export default function Home() {
  // ==========================================
  // 🔐 ESTADOS DE SEGURIDAD Y PERFIL (NUEVO)
  // ==========================================
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [vistaModal, setVistaModal] = useState<'perfil' | 'editar' | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [rangoGrafico, setRangoGrafico] = useState<'7dias' | '30dias' | 'esteMes'>('7dias');
  
  // ==========================================
  // 👥 ESTADOS DE GESTIÓN DE PERSONAL (NUEVO)
  // ==========================================
  const [userList, setUserList] = useState<UserData[]>([]);
  const [filtroRol, setFiltroRol] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', nombre_completo: '', edad: 18, role: 'RECEPCION' });
  const [editProfileForm, setEditProfileForm] = useState({ username: '', nombre_completo: '', password: '', foto: '', edad: 0 });
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  // ==========================================
  // ⚡ ESTADOS DE LA APLICACIÓN (EXISTENTES)
  // ==========================================
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState<'dashboard' | 'emision' | 'reporte' | 'usuarios'>('emision');
  const [empresaIndex, setEmpresaIndex] = useState(0);
  const [fechaEmision, setFechaEmision] = useState(new Date().toLocaleDateString('sv-SE'));
  const [tipoDoc, setTipoDoc] = useState('03');
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');

  const [items, setItems] = useState<ItemVenta[]>([]);
  const [tempProducto, setTempProducto] = useState('');
  const [tempCantidad, setTempCantidad] = useState(1);
  const [tempPrecio, setTempPrecio] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [historial, setHistorial] = useState<TicketHistorial[]>([]);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroEmpresaRuc, setFiltroEmpresaRuc] = useState('');
  const [filtroEstado, setFiltroEstado] = useState(''); 
  const [filtroTipo, setFiltroTipo] = useState('');

  const [avisoRuc, setAvisoRuc] = useState('');

  const [totalPdfDetectado, setTotalPdfDetectado] = useState<number | null>(null);
  const [igvPdf, setIgvPdf] = useState(0);
  const [ticketOrigen, setTicketOrigen] = useState('');
  const [nroTicket, setNroTicket] = useState(''); 
  const [modalAlerta, setModalAlerta] = useState<{ abierto: boolean, titulo: string, mensaje: string, tipo: 'warning' | 'info', accion?: () => void }>({ abierto: false, titulo: '', mensaje: '', tipo: 'info' });
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const empresaSeleccionada = EMPRESAS[empresaIndex];
  const formatoMoneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });
  const totalGeneral = items.reduce((sum, item) => sum + item.total, 0);

  

  const playSuccess = () => { const a = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'); a.volume = 0.5; a.play().catch(() => {}); };
  const playWarning = () => { const a = new Audio('https://assets.mixkit.co/active_storage/sfx/2021/2021-preview.mp3'); a.volume = 0.4; a.play().catch(() => {}); };

  // Validadores
  const validarRUC = (ruc: string) => /^(10|20|15|17)\d{9}$/.test(ruc);
  const validarDNI = (dni: string) => /^\d{8}$/.test(dni);
  const validarTexto = (texto: string, minLength: number) => texto && texto.trim().length >= minLength;

  const fechaMinima = new Date();
  fechaMinima.setDate(fechaMinima.getDate() - 2);
  const minDateStr = fechaMinima.toLocaleDateString('sv-SE');
  const maxDateStr = new Date().toLocaleDateString('sv-SE');

  useEffect(() => {
    if (isLoggedIn) {
      cargarHistorial();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    verificarDocumento();
  }, [clienteDoc, tipoDoc]);

  // 💓 HEARTBEAT (POLLING) - SEGURIDAD SINGLE SESSION
  useEffect(() => {
    // Si no ha iniciado sesión, no hacemos nada
    if (!isLoggedIn) return;

    // Configuramos el "latido" cada 10 segundos (10000 milisegundos)
    const interval = setInterval(async () => {
      const token = localStorage.getItem('gv_token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/auth/check-session`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache' // Evita respuestas cacheadas
           },
           cache: 'no-store' // Asegura que no se almacene en cache
        });

        // 🚨 TRAMPA PARA EL INTRUSO (Automática)
        if (res.status === 401) {
          const data = await res.json();
          if (data.message === 'SESION_DUPLICADA') {
            clearInterval(interval); // Apagamos el latido
            
            setModalAlerta({
              abierto: true,
              titulo: "🚨 Sesión Finalizada",
              mensaje: "Se ha iniciado sesión con tu cuenta en otro dispositivo. Por seguridad, hemos cerrado tu sesión actual.",
              tipo: 'warning',
              accion: () => {
                localStorage.clear();
                setIsLoggedIn(false);
                setCurrentUser(null);
                setVistaModal(null); // Cerramos cualquier menú abierto
              }
            });
          }
        }
      } catch (error) {
        console.error("Comprobando sesión en segundo plano...");
      }
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [isLoggedIn]);

  // ==========================================
  // 👥 FUNCIONES DE GESTIÓN DE USUARIOS
  // ==========================================
  const cargarUsuarios = async () => {
    try {
      const token = localStorage.getItem('gv_token');
      const res = await fetch(`${API_URL}/auth/users${filtroRol ? `?role=${filtroRol}` : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUserList(await res.json());
    } catch (e) { console.error("Error cargando usuarios", e); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gv_token');
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm)
      });
      if (res.ok) {
        playSuccess(); alert("✅ Usuario registrado exitosamente"); setShowAddUserModal(false); cargarUsuarios();
      } else { alert("❌ Error al crear usuario"); }
    } catch (e) { alert("Error conexión"); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingUser ? editingUser.id : currentUser?.id;
    if (!targetId) return;

    try {
      const token = localStorage.getItem('gv_token');
      const updateData = Object.fromEntries(Object.entries(editProfileForm).filter(([_, v]) => v !== ''));
      const res = await fetch(`${API_URL}/auth/profile/${targetId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (res.ok) {
        const updated = await res.json();
        if (!editingUser) { 
          setCurrentUser(updated);
          localStorage.setItem('gv_user', JSON.stringify(updated));
        }
        playSuccess();
        setVistaModal(null);
        setEditingUser(null); 
        alert("✅ Cambios guardados correctamente");
        cargarUsuarios(); 
      }
    } catch (e) { alert("Error al actualizar"); }
  };
  const handleDeleteUser = async (id: number) => {
    if (!confirm("⚠️ ¿Estás seguro de eliminar a este usuario? Esta acción es definitiva.")) return;
    try {
      const token = localStorage.getItem('gv_token');
      const res = await fetch(`${API_URL}/auth/users/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        playSuccess();
        alert("Usuario eliminado correctamente");
        cargarUsuarios(); 
      } else {
        alert("Error: No se pudo eliminar al usuario.");
      }
    } catch (e) { alert("Error de red"); }
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setEditProfileForm({ ...editProfileForm, foto: reader.result as string }); };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ==========================================
  // ⚡ LÓGICA DE NEGOCIO (PRESERVADA)
  // ==========================================
  const extraerSerieNumero = (filename?: string) => {
    if (!filename) return '-';
    // Intenta extraer formato: RUC-TIPO-SERIE-CORRELATIVO
    const partes = filename.split('-');
    if (partes.length >= 4) {
        return `${partes[2]}-${partes[3].replace('.xml','').replace('.pdf','')}`; 
    }
    return filename;
  };

  const verificarDocumento = () => {
    if (tipoDoc === '01') { 
        if (clienteDoc.length > 0 && !validarRUC(clienteDoc)) setAvisoRuc("⚠️ RUC inválido (11 dígitos).");
        else setAvisoRuc("");
    } else { 
        if (clienteDoc.length > 0 && !validarDNI(clienteDoc)) setAvisoRuc("⚠️ DNI inválido (8 dígitos).");
        else setAvisoRuc("");
    }
  };

  const completarPuntos = () => {
    if (tipoDoc === '01' && clienteDoc.startsWith('20')) {
      let nombre = clienteNombre.trim();
      // Diccionario de reemplazos comunes
      const reemplazos = [
        { regex: /\bSAC$/i, replacement: "S.A.C." },
        { regex: /\bSA$/i, replacement: "S.A." },
        { regex: /\bSRL$/i, replacement: "S.R.L." },
        { regex: /\bSAA$/i, replacement: "S.A.A." },
        { regex: /\bEIRL$/i, replacement: "E.I.R.L." }
      ];
      reemplazos.forEach(r => {
        if (r.regex.test(nombre)) nombre = nombre.replace(r.regex, r.replacement);
      });
      setClienteNombre(nombre);
    }
  };

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    
    // Solo permitimos caracteres válidos

    const esPersonaNatural = tipoDoc === '03' || (tipoDoc === '01' && ['10', '15', '16', '17'].includes(clienteDoc.substring(0, 2)));
    if (esPersonaNatural) {
      if (/^[A-ZÑÁÉÍÓÚ\s']*$/.test(val) || val === '') setClienteNombre(val);
    } else {
      setClienteNombre(val);
    }
  };

  const ejecutarCargaPdf = async (file: File) => {
    setLoading(true);
    setItems([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/simulation/parse-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.nroTicket) {
          console.log("✅ TK detectado:", data.nroTicket);
          setNroTicket(data.nroTicket); // Actualiza el estado
      }
      if (data.nroTicket) {
        const ticketDuplicado = historial.find(t =>
          t.nro_ticket === data.nroTicket && !t.anulado && t.estado !== 'ERROR'
        );
        if (ticketDuplicado) {
          setModalAlerta({
            abierto: true,
            titulo: "⚠️ Ticket ya Procesado",
            mensaje: `El ticket N° ${data.nroTicket} ya fue registrado anteriormente el día ${new Date(ticketDuplicado.created_at).toLocaleDateString()}. Por favor, verifique para evitar duplicidad.`,
            tipo: 'warning'
          });
          playWarning();
          setItems([]); return;
        }
      }

      if (data.error === 'INVALID_FORMAT') {
        setModalAlerta({
          abierto: true,
          titulo: "❌ Archivo no Compatible",
          mensaje: "El archivo subido no parece ser un PDF válido de ticket o factura. Por favor, verifica y vuelve a intentarlo.",
          tipo: 'warning'
        });
        playWarning();
        return;
      }


      if (data.warning) {
        playWarning();
        alert(`⚠️ ATENCIÓN:\n${data.warning}`);
      } else if (data.error) {
        playWarning();
        alert(`❌ ERROR:\n${data.error}`);
        return;
      }

      if (data.fecha) {
          if (data.fecha < minDateStr) { // Si es más antiguo de 2 días
              setModalAlerta({
                  abierto: true,
                  titulo: "⚠️ Fecha Ajustada",
                  mensaje: `El ticket es del ${data.fecha}. Se ha ajustado al ${minDateStr} (límite de 2 días) para evitar problemas contables.`,
                  tipo: 'warning'
              });
              setFechaEmision(minDateStr);
          } else {
              setFechaEmision(data.fecha);
          }
      }

      if (data.cliente?.nombre) setClienteNombre(data.cliente.nombre);

      const nuevosItems = (data.items || []).map((it: any, idx: number) => ({
        id: Date.now() + idx,
        producto: it.producto,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        total: it.total,
        glosa: it.glosa
      }));

      setItems(nuevosItems);
      setTotalPdfDetectado(data.total_detectado);
      if (data.igv_detectado) setIgvPdf(data.igv_detectado);

    } catch (error) {
      playWarning();
      alert("❌ Error de conexión al leer PDF.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTicketOrigen(file.name);
    setClienteDoc('');

    // Validar si ya existen items
    if (items.length > 0) {
        setModalAlerta({
          abierto: true,
          titulo: "⚠️ Venta en curso",
          mensaje: "Ya tienes productos cargados. ¿Deseas borrarlos para cargar el nuevo PDF?",
          tipo: 'warning',
          accion: () => {
            ejecutarCargaPdf(file);
            setModalAlerta(prev => ({ ...prev, abierto: false }));
          }
        });

      // Limpiamos el input file visualmente
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    ejecutarCargaPdf(file);
  };

  const descargarTicket = async (filename: string | undefined, id: number) => {
    if (!filename) {
        playWarning();
        alert("El ticket no tiene archivo asociado.");
        return;
    }

    try {
        const nombreLimpio = filename.replace('.html', '').replace('.pdf', '');
        const token = localStorage.getItem('gv_token');
        
        const res = await fetch(`${API_URL}/tickets/download/${nombreLimpio}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("No autorizado o archivo no encontrado");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');

    } catch (error) {
        playWarning();
        alert("Error al descargar el PDF. La sesión puede haber expirado.");
    }
  };

  const procesarItem = () => {
    if (!validarTexto(tempProducto, 3)) { alert("Descripción muy corta"); return; }
    const p = parseFloat(tempPrecio);
    const c = tempCantidad;
    if (isNaN(p) || p <= 0) { alert("El precio debe ser mayor a 0"); return; }
    if (c <= 0) { alert("La cantidad debe ser mayor a 0"); return; }

    const ni = { 
    id: editandoId || Date.now(), 
    producto: tempProducto, 
    cantidad: c, 
    precio_unitario: p, 
    total: p * c 
  };

    if (editandoId !== null) {
        setItems(items.map(item => item.id === editandoId ? ni : item));
        setEditandoId(null);
    } else {
        setItems([...items, ni]);
    }
    setTempProducto(''); setTempCantidad(1); setTempPrecio('');
  };

  const prepararEdicion = (item: ItemVenta) => { setTempProducto(item.producto); setTempCantidad(item.cantidad); setTempPrecio(item.precio_unitario.toString()); setEditandoId(item.id); };
  const eliminarItem = (id: number) => {
    const nuevosItems = items.filter(i => i.id !== id);
    setItems(nuevosItems);

    if (nuevosItems.length === 0) {
          setTicketOrigen('');
          setNroTicket('');
          setTotalPdfDetectado(null);
          setIgvPdf(0);
      }
  };

  const iniciarEmision = () => {
    // 1. Validaciones básicas
    if (items.length === 0) { alert("Agrega productos"); return; }

    if (!clienteDoc || clienteDoc.trim() === "") {
      setModalAlerta({ abierto: true, titulo: "⚠️ Documento Obligatorio", mensaje: `Debe ingresar el ${tipoDoc === '01' ? 'RUC' : 'DNI'} del cliente.`, tipo: 'warning' });
      return;
    }

    if (!validarTexto(clienteNombre, 3)) { alert("Nombre inválido"); return; }

    if (tipoDoc === '01') {
      if (!validarRUC(clienteDoc)) {
        alert("RUC inválido");
        return;
      }

      if (clienteDoc.startsWith('20')) {
        const regexSociedadEstricta = /\b(S\.A\.|S\.A\.C\.|S\.R\.L\.|S\.A\.A\.|E\.I\.R\.L\.)$/i;

        if (!regexSociedadEstricta.test(clienteNombre.trim())) {
          setModalAlerta({
            abierto: true,
            titulo: "📋 Error en Razón Social",
            mensaje:
              "Para facturas de sociedades, la razón social debe terminar exactamente en S.A., S.A.C., S.R.L. , S.A.A. o E.I.R.L. (incluyendo los puntos).",
            tipo: 'warning',
          });
          return;
        }
      }
    }
    if (tipoDoc === '03') {
      if (!validarDNI(clienteDoc)) {
        alert("DNI inválido");
        return;
      }
    }

    // 5. Validación de montos contra PDF
    if (totalPdfDetectado !== null && totalPdfDetectado > 0) {
      const diferencia = Math.abs(totalGeneral - totalPdfDetectado);
      if (diferencia > 0.10) {
        if (!confirm(
          `⚠️ DIFERENCIA DE MONTOS\n\nPDF: S/ ${totalPdfDetectado.toFixed(2)}\nCalculado: S/ ${totalGeneral.toFixed(2)}\n\n¿Continuar de todas formas?`
        )) return;
      }
    }
    //Todo OK → confirmación final
    setMostrarModalConfirmacion(true);
  };

  const confirmarYEmitir = async () => {
    setMostrarModalConfirmacion(false);
    setLoading(true);
    try {
      const now = new Date();

      // 🔥 LÓGICA DE SERIES POR EMPRESA (El Estándar Profesional)
      let serieComprobante = tipoDoc === '01' ? 'F005' : 'B005';
      

      const payload = {
        emisor: { ...empresaSeleccionada, ubigueo: '150101' },
        tipo_comprobante: tipoDoc,
        serie: serieComprobante,
        fecha_emision: fechaEmision, 
        hora_emision: now.toLocaleTimeString('en-GB'),
        cliente: { nombre: clienteNombre, dni: clienteDoc, tipo_doc: tipoDoc === '01' ? '6' : '1', direccion: clienteDireccion },
        items: items.map(i => ({ producto: i.producto, cantidad: i.cantidad, precio_total: i.total, valor_unitario: i.precio_unitario, glosa: i.glosa})),
        ticket_origen: ticketOrigen,
        nro_ticket: nroTicket
      };

      const token = localStorage.getItem('gv_token');

      const res = await fetch(`${API_URL}/tickets`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }, 
        body: JSON.stringify(payload) 
      });
      
      if (res.ok) {
        playSuccess();
        alert(`✅ ¡ÉXITO!\nComprobante generado.`);
        setItems([]); setClienteDoc(''); setClienteNombre(''); setClienteDireccion(''); setTicketOrigen(''); setIgvPdf(0); setAvisoRuc(''); setTotalPdfDetectado(null); setNroTicket('');
        cargarHistorial();
        setVista('reporte'); // Ir al reporte automáticamente
      } else {
        const errData = await res.json();
        alert("Error: " + JSON.stringify(errData));
      }
    } catch (error) { playWarning(); alert("Error de conexión"); } finally { setLoading(false); }
  };

  const anularComprobante = async (ticket: TicketHistorial) => {
    if (!confirm(`⚠️ ¿Estás seguro de ANULAR el comprobante #${ticket.id}?\n\nSe emitirá una NOTA DE CRÉDITO por S/ ${Math.abs(ticket.total_venta)}.`)) return;

    setLoading(true);
    try {
        const now = new Date();
        let tipoDocRef = '01'; 
        let serieNumRef = '';
        
        // 1. Extraemos el RUC real de la venta desde el filename guardado
        let rucTicket = empresaSeleccionada.ruc; // Valor por defecto

        if (ticket.filename) {
            const partes = ticket.filename.split('-');
            if (partes.length >= 4) {
                rucTicket = partes[0]; // Esto detectará automáticamente "20609526964"
                tipoDocRef = partes[1]; 
                serieNumRef = `${partes[2]}-${partes[3].replace('.xml', '').replace('.html', '')}`;
            }
        } else {
            tipoDocRef = ticket.cliente_data.tipo_doc === '6' ? '01' : '03';
            serieNumRef = `${tipoDocRef === '01' ? 'F005' : 'B005'}-${ticket.id}`;
        }

        // 2. Buscamos los datos exactos de Proxima Centauri usando el RUC detectado
        const emisorCorrecto = EMPRESAS.find(e => e.ruc === rucTicket) || empresaSeleccionada;

        const payloadNota = {
            emisor: { ...emisorCorrecto, ubigueo: '150101' }, // 👈 AHORA SIEMPRE USARÁ LA EMPRESA CORRECTA
            tipo_comprobante: '07', // Nota de crédito
            serie: serieNumRef.split('-')[0], // Corregido: tipoDocRef
            fecha_emision: now.toLocaleDateString('sv-SE'),
            hora_emision: now.toLocaleTimeString('en-GB'),
            cliente: ticket.cliente_data,
            items: ticket.items_data.map((i: any) => ({
                producto: i.producto || i.descripcion,
                cantidad: i.cantidad,
                valor_unitario: i.valor_unitario, 
                precio_total: i.precio_total || (i.valor_unitario * i.cantidad)
            })),
            referencia_id: ticket.id,
            
            // Datos originales que tenías
            doc_afectado: serieNumRef,       
            tipo_doc_afectado: tipoDocRef,
            
            // 🛡️ NUEVO: Variables exactas que nuestro InvoiceGenerator.php espera para la Nota
            tipoDocAfectado: tipoDocRef,
            numDocAfectado: serieNumRef,
            codMotivo: '01',
            desMotivo: 'ANULACION DE LA OPERACION',
            
            referencia_data: {
              fecha: new Date(ticket.created_at).toISOString().split('T')[0],
              tipo: tipoDocRef,
              serie: serieNumRef.split('-')[0],
              numero: serieNumRef.split('-')[1]
            }
        };

        const token = localStorage.getItem('gv_token');

        const res = await fetch(`${API_URL}/tickets`, { 
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payloadNota),
        });

        const data = await res.json();
        if (res.ok) { 
            playSuccess(); 
            alert("✅ Comprobante Anulado Correctamente (Nota de Crédito generada)"); 
            cargarHistorial(); 
        } else { 
            playWarning(); 
            alert("❌ Error al anular: " + (data.message || JSON.stringify(data))); 
        }
    } catch (e) { 
        alert("Error de conexión"); 
    } finally { 
        setLoading(false); 
    }
  };

  const cargarHistorial = async () => {
    try {
      // 1. Sacamos la llave guardada
      const token = localStorage.getItem('gv_token'); 
      
      const res = await fetch(`${API_URL}/tickets`, {
        headers: { 
           'Authorization': `Bearer ${token}` // 👈 2. Le mostramos la llave al portero
        } 
      });

      // 3. 🚨 TRAMPA PARA EL INTRUSO 🚨
      if (res.status === 401) {
          const data = await res.json();
          if (data.message === 'SESION_DUPLICADA') {
              setModalAlerta({
                  abierto: true,
                  titulo: "🚨 Sesión Finalizada",
                  mensaje: "Se ha iniciado sesión con tu cuenta en otro dispositivo. Por seguridad, hemos cerrado tu sesión actual.",
                  tipo: 'warning',
                  accion: () => {
                      // Expulsamos al usuario visualmente
                      localStorage.clear();
                      setIsLoggedIn(false);
                      setCurrentUser(null);
                  }
              });
              return; // Detenemos la ejecución
          }
      }

      if (res.ok) setHistorial(await res.json());
    } catch (error) { console.error("Error historial", error); }
  };

  const historialFiltrado = () => {
    return historial.filter(t => {
        const fechaTicket = new Date(t.created_at).toISOString().split('T')[0];
        const dentroDeFecha = fechaTicket >= fechaInicio && fechaTicket <= fechaFin;
        
        const nombreCliente = t.cliente_data?.nombre?.toLowerCase() || '';
        const docCliente = t.cliente_data?.dni || '';
        const coincideBusqueda = nombreCliente.includes(busquedaTexto.toLowerCase()) || docCliente.includes(busquedaTexto);

        let coincideEmpresa = true;
        if (filtroEmpresaRuc) {
            if (t.filename) {
                coincideEmpresa = t.filename.startsWith(filtroEmpresaRuc);
            } else {
                coincideEmpresa = false; 
            }
        }

        let coincideEstado = true;
        if (filtroEstado) {
            if (filtroEstado === 'ANULADO') coincideEstado = t.anulado === true;
            else if (filtroEstado === 'FIRMADO') coincideEstado = t.estado === 'FIRMADO' && !t.anulado;
        }

        let coincideTipo = true;
        if (filtroTipo) {
            const esNotaCredito = Number(t.total_venta) < 0;
            if (filtroTipo === 'VENTA') coincideTipo = !esNotaCredito;
            else if (filtroTipo === 'NOTA_CREDITO') coincideTipo = esNotaCredito;
        }

        return dentroDeFecha && coincideBusqueda && coincideEmpresa && coincideEstado && coincideTipo;
    });
  };

  const exportarExcel = () => {
    const filtrados = historialFiltrado();
    if (filtrados.length === 0) { alert("No hay datos para exportar"); return; }
    
    let csvContent = "data:text/csv;charset=utf-8,ID,FECHA,CLIENTE_DOC,CLIENTE_NOMBRE,COMPROBANTE,TIPO,TOTAL,TICKET_DE_VENTA,ESTADO,ANULADO,ARCHIVO\n";
    filtrados.forEach(row => {
        const fecha = new Date(row.created_at).toLocaleDateString();
        const tipo = Number(row.total_venta) < 0 ? 'NOTA CREDITO' : 'VENTA';
        const totalStr = Number(row.total_venta).toFixed(2);
        const comprobante = extraerSerieNumero(row.filename);


        
        csvContent += `${row.id},${fecha},${row.cliente_data?.dni},"${row.cliente_data?.nombre}",${comprobante},${tipo},${totalStr},${row.nro_ticket || ''},${row.estado},${row.anulado ? 'SI' : 'NO'},${row.filename || ''}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `reporte_ventas_${fechaInicio}_al_${fechaFin}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const exportarGenerico = () => {
    const filtrados = historialFiltrado();
    const data = filtrados.map(t => ({
      'ID': t.id,
      'FECHA': new Date(t.created_at).toLocaleDateString(),
      'CLIENTE': t.cliente_data?.nombre,
      'DOCUMENTO': t.cliente_data?.dni,
      'TOTAL': t.total_venta,
      'TIPO': t.total_venta < 0 ? 'NOTA CRÉDITO' : 'VENTA',
      'ESTADO': t.estado,
      'N° TICKET': t.nro_ticket,
      'ORIGEN': t.ticket_origen,
      'ARCHIVO': t.filename
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Recepcion");
    XLSX.writeFile(wb, `Reporte_Recepcion_${fechaInicio}.xlsx`);
  };

  const obtenerGlosaContasis = (items?: any[]) =>
  Array.isArray(items)
    ? items
        .map(i => i.glosa)
        .filter(Boolean)
        .join(', ')
        .substring(0, 80)
    : '';

  const exportarContasis = () => {

    if (currentUser?.role === 'CONTADOR' && !filtroEmpresaRuc) {
      alert("⚠️ Debe filtrar por una Empresa Emisora específica para exportar este formato.");
      return;
    }

    const filtrados = historialFiltrado();
    if (filtrados.length === 0) { 
      alert("No hay datos"); 
      return; 
    }
    const dataContasis = filtrados.map(t => {
      const fecha = new Date(t.created_at).toISOString().split('T')[0];
      // Tipo de documento CONTASIS
      let ccoddoc = '03'; // Boleta
      if (t.filename?.includes('-01-')) ccoddoc = '01'; // Factura
      if (t.total_venta < 0) ccoddoc = '07'; // Nota de Crédito

      const partes = t.filename?.split('-') || [];
      const serieRaw = partes[2] || '';
      const numeroRaw = partes[3]?.replace('.xml','').replace('.pdf','') || '';
      const glosa = obtenerGlosaContasis(t.items_data);
      return {
        'ffechadoc D': fecha,
        'ffechaven D': fecha,
        'ccoddoc C(2)': ccoddoc,
        'cserie C(20)': serieRaw.padStart(20, '0'),
        'cnumero C(20)': numeroRaw.padStart(20, '0'),
        'ccodenti C(11)': '01', 
        'cdesenti C(100)': 'MI ORGANIZACIÓN',
        'ctipdoc C(1)': t.cliente_data?.tipo_doc === '6' ? '6' : '1',
        'ccodruc C(15)': t.cliente_data?.dni || '',
        'crazsoc C(100)': t.cliente_data?.nombre || '',
        'nbase2 N(15,2)': '', // Campo manual
        'nbase1 N(15,2)': t.base_imponible || (t.total_venta / 1.18).toFixed(2),
        'nexo N(15,2)': '',   // Campo manual
        'nina N(15,2)': '',   // Campo manual
        'nisc N(15,2)': '',   // Campo manual
        'nigv1 N(15,2)': t.igv || (t.total_venta - (t.total_venta / 1.18)).toFixed(2),
        'nicbpers N(15,2)': '', // Campo manual
        'nbase3 N(15,2)': '',  // Campo manual
        'ntots N(15,2)': Math.abs(t.total_venta),
        'ntc N(10,6)': '', 
        'freffec D': t.referencia_data?.fecha || '',
        'crefdoc C(2)': t.referencia_data?.tipo || '',
        'crefser C(6)': t.referencia_data?.serie || '',
        'crefnum C(13)': t.referencia_data?.numero || '',
        'cmreg C(1)': 'S', // Indicador fijo en el ejemplo
        'ndolar N(15,2)': '',
        'ffechaven2 D': fecha,
        'ccond C(3)': 'CON',
        'ccodcos C(9)': '',
        'ccodcos2 C(9)': '',
        'cctabase C(20)': '70121', // Cuenta contable ejemplo
        'cctaicbper C(20)': '',
        'cctaotrib C(20)': '40111',
        'cctatot C(20)': '1212',
        'nresp N(1)': '',
        'nporre N(5,2)': '',
        'nimpres N(15,2)': '',
        'cserre C(6)': '',
        'cnumre C(13)': '',
        'ffecre D': '',
        'ccodpresu C(10)': '',
        'nigv N(5,2)': '18', // Porcentaje IGV
        'cglosa C(80)': glosa,
        'ccodpago C(3)': 'CON',
        'nperdenre N(1)': '',
        'nbaseres N(15,2)': '',
        'cctaperc C(20)': ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(dataContasis);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro_ventas');

    XLSX.writeFile(wb, `CONTASIS_GOVISION_${fechaInicio}.xlsx`);
  };

  // --- SESIÓN Y PERSISTENCIA ---
  useEffect(() => {
    const tk = localStorage.getItem('gv_token');
    const u = localStorage.getItem('gv_user');
    if (tk && u) { 
      const parsedUser = JSON.parse(u);
      setCurrentUser(parsedUser); 
      setIsLoggedIn(true); 
      cargarHistorial(); // 👈 Agregamos esto aquí para que si refrescas la página, los datos se recarguen
      if (parsedUser.role === 'CONTADOR') setVista('reporte'); 
    }
  }, []);

  useEffect(() => {
    if (vista === 'usuarios' && isLoggedIn) cargarUsuarios();
  }, [vista, filtroRol, isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setLoginError('');
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('gv_token', data.access_token);
        localStorage.setItem('gv_user', JSON.stringify(data.user));
        setCurrentUser(data.user); setIsLoggedIn(true); playSuccess();
        if (data.user.role === 'ADMIN') setVista('dashboard'); 
        else if (data.user.role === 'CONTADOR') setVista('reporte'); 
        else setVista('emision');
      } else { setLoginError(data.message || "Error al entrar"); playWarning(); }
    } catch (err) { setLoginError("Error de red"); } finally { setLoading(false); }
  };

  const handleLogout = () => { localStorage.clear(); setIsLoggedIn(false); setCurrentUser(null); };
  
  // --- CÁLCULOS PARA EL DASHBOARD ---
  const calcularMetricasHoy = () => {
    const hoyStr = new Date().toLocaleDateString('sv-SE'); // Obtiene la fecha de hoy "YYYY-MM-DD"
    
    let ventasHoy = 0;
    let notasCreditoHoy = 0;
    let cantidadDocs = 0;

    historial.forEach(t => {
      const fechaTicket = new Date(t.created_at).toLocaleDateString('sv-SE');
      if (fechaTicket === hoyStr && t.estado === 'FIRMADO') {
        cantidadDocs++;
        if (Number(t.total_venta) > 0) {
          ventasHoy += Number(t.total_venta);
        } else {
          notasCreditoHoy += Math.abs(Number(t.total_venta)); // Sumamos las anulaciones
        }
      }
    });

    return { ventasHoy, notasCreditoHoy, cantidadDocs };
  };

  const metricas = calcularMetricasHoy();

  const generarDatosGraficos = () => {
    const dias = [];
    let diasAtras = 6; // Por defecto 7 días
    
    if (rangoGrafico === '30dias') diasAtras = 29;
    else if (rangoGrafico === 'esteMes') {
      const hoy = new Date();
      diasAtras = hoy.getDate() - 1; // Días transcurridos en el mes actual
    }

    // Generamos las fechas hacia atrás
    for (let i = diasAtras; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d.toLocaleDateString('sv-SE'));
    }

    return dias.map(fecha => {
      const ticketsDelDia = historial.filter(t => t.created_at.startsWith(fecha) && t.estado === 'FIRMADO');
      
      const ingresos = ticketsDelDia.reduce((sum, t) => Number(t.total_venta) > 0 ? sum + Number(t.total_venta) : sum, 0);
      const anulaciones = ticketsDelDia.reduce((sum, t) => Number(t.total_venta) < 0 ? sum + Math.abs(Number(t.total_venta)) : sum, 0);

      const dateObj = new Date(fecha + 'T00:00:00');
      
      // Si son muchos días (30), mostramos el formato "15 Feb" para que no se amontone
      let diaStr = '';
      if (rangoGrafico === '7dias') {
         diaStr = dateObj.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
      } else {
         diaStr = dateObj.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
      }

      return {
        fecha: diaStr.charAt(0).toUpperCase() + diaStr.slice(1), 
        Ingresos: ingresos,
        Anuladas: anulaciones
      };
    });
  };

  const datosGrafico = generarDatosGraficos();
 

  // ==========================================
  // 🖥️ RENDERS
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-200">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-cyan-600 rounded-3xl flex items-center justify-center text-white font-black text-4xl mx-auto mb-4 shadow-xl">GV</div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Go Visión</h1>
            <p className="text-slate-400 font-bold mt-2 uppercase text-[10px]">Portal de Gestión Médica</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group"><User className="absolute left-4 top-4 text-slate-400" /><input type="text" placeholder="Usuario" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}/></div>
            <div className="relative group"><Lock className="absolute left-4 top-4 text-slate-400" /><input type="password" placeholder="Contraseña" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}/></div>
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100">{loginError}</p>}
            <button type="submit" disabled={loading} className="w-full py-5 bg-cyan-600 text-white font-black rounded-2xl shadow-lg hover:bg-cyan-700 transition-all transform active:scale-95">{loading ? 'Verificando...' : 'INGRESAR'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      {/* --- NAVBAR --- */}
      <nav className="bg-white border-b px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">GV</div>
          <div><h1 className="text-xl font-black text-slate-800">Go Visión</h1><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{currentUser?.role}</p></div>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                {currentUser?.role === 'ADMIN' && (
                  <>
                    <button onClick={() => setVista('dashboard')} className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all ${vista === 'dashboard' ? 'bg-white text-cyan-700 shadow-md scale-105' : 'text-slate-500'}`}>Dashboard</button>
                    <button onClick={() => setVista('usuarios')} className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all ${vista === 'usuarios' ? 'bg-white text-cyan-700 shadow-md scale-105' : 'text-slate-500'}`}>Personal</button>
                  </>
                )}
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'RECEPCION') && (
                  <button onClick={() => setVista('emision')} className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all ${vista === 'emision' ? 'bg-white text-cyan-700 shadow-md scale-105' : 'text-slate-500'}`}>Venta</button>
                )}
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'CONTADOR' || currentUser?.role === 'RECEPCION') && (
                  <button onClick={() => setVista('reporte')} className={`px-5 py-2.5 text-sm font-black rounded-xl transition-all ${vista === 'reporte' ? 'bg-white text-cyan-700 shadow-md scale-105' : 'text-slate-500'}`}>Reportes</button>
                )}
            </div>

            {/* --- AVATAR MENU (NUEVO) --- */}
            <div className="relative">
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 p-1 bg-white border rounded-full hover:shadow-md transition-all">
                    {currentUser?.foto ? (
                      <img src={currentUser.foto} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center font-black text-sm">{getInitials(currentUser?.nombre_completo || 'User')}</div>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>
                {showProfileMenu && (
                  <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-6 bg-slate-50 border-b">
                          <p className="font-black text-slate-800 truncate">{currentUser?.nombre_completo}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{currentUser?.username}</p>
                      </div>
                      <div className="p-2">
                          <button onClick={() => { setVistaModal('perfil'); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 p-4 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"><UserCircle size={18}/> Ver Perfil</button>
                          <button onClick={() => { setVistaModal('editar'); setEditProfileForm({ username: currentUser!.username, nombre_completo: currentUser!.nombre_completo, password: '', foto: currentUser!.foto || '', edad: currentUser!.edad}); setShowProfileMenu(false); }} className="w-full flex items-center gap-3 p-4 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-2xl transition-all"><Settings size={18}/> Editar Información</button>
                          <hr className="my-2 border-slate-100"/>
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-2xl transition-all"><LogOut size={18}/> Cerrar Sesión</button>
                      </div>
                  </div>
                )}
            </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto mt-8 p-6">
        
        {/* --- VISTA DASHBOARD --- */}
        {vista === 'dashboard' && currentUser?.role === 'ADMIN' && (
          <div className="space-y-8 animate-in fade-in">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Panel de Control General</h2>
            
            {/* 1. LAS TARJETAS PRINCIPALES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden transition-transform hover:scale-[1.02]">
                <div className="relative z-10">
                  <h4 className="opacity-80 font-bold uppercase text-[10px] mb-2 tracking-widest flex items-center gap-2">Ingresos Hoy</h4>
                  <p className="text-4xl font-black">{formatoMoneda.format(metricas.ventasHoy)}</p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] bg-white/20 w-fit px-4 py-1.5 rounded-full backdrop-blur-sm"><CheckCircle2 size={12}/> {metricas.cantidadDocs} Documentos emitidos</div>
                </div>
                <div className="absolute -right-6 -bottom-6 opacity-10"><ReceiptText size={150}/></div>
              </div>

              <div className="bg-gradient-to-br from-red-500 to-red-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden transition-transform hover:scale-[1.02]">
                <div className="relative z-10">
                  <h4 className="opacity-90 font-bold uppercase text-[10px] mb-2 tracking-widest">Anulaciones Hoy</h4>
                  <p className="text-4xl font-black">{formatoMoneda.format(metricas.notasCreditoHoy)}</p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] bg-white/20 w-fit px-4 py-1.5 rounded-full backdrop-blur-sm"><Info size={12}/> Dinero devuelto / anulado</div>
                </div>
                <div className="absolute -right-6 -bottom-6 opacity-10"><XCircle size={150}/></div>
              </div>

              <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center items-center text-center transition-transform hover:scale-[1.02]">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-inner"><CheckCircle2 size={32}/></div>
                <h4 className="text-slate-800 font-black text-lg">Sistema Operativo</h4>
                <p className="text-slate-400 text-xs font-bold mt-1">Conectado a SUNAT Producción</p>
              </div>
            </div>

            {/* 2. LA ZONA DE GRÁFICOS */}
            <div className="mt-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Análisis Financiero</h3>
                  <p className="text-xs font-bold text-slate-400">Rendimiento y flujo de caja en el tiempo</p>
                </div>
                
                {/* SELECTOR DE FECHAS */}
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
                    <button onClick={() => setRangoGrafico('7dias')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-black rounded-lg transition-all ${rangoGrafico === '7dias' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>7 Días</button>
                    <button onClick={() => setRangoGrafico('30dias')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-black rounded-lg transition-all ${rangoGrafico === '30dias' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>30 Días</button>
                    <button onClick={() => setRangoGrafico('esteMes')} className={`flex-1 md:flex-none px-4 py-2 text-xs font-black rounded-lg transition-all ${rangoGrafico === 'esteMes' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>Este Mes</button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              
              {/* Gráfico 1: Tendencia de Ingresos */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-800">Tendencia de Ingresos</h3>
                  <p className="text-xs font-bold text-slate-400">Evolución de los últimos 7 días</p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={datosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 700}} tickFormatter={(val) => `S/ ${val}`} />
                      <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} labelStyle={{fontWeight: 900, color: '#1e293b'}} />
                      <Area type="monotone" dataKey="Ingresos" stroke="#0891b2" strokeWidth={4} fillOpacity={1} fill="url(#colorIngresos)" activeDot={{r: 6, strokeWidth: 0, fill: '#0891b2'}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Comparativa Ingresos vs Anulaciones */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="mb-6">
                  <h3 className="text-lg font-black text-slate-800">Flujo de Caja Neto</h3>
                  <p className="text-xs font-bold text-slate-400">Ingresos vs Notas de Crédito</p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosGrafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 700}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8', fontWeight: 700}} tickFormatter={(val) => `S/ ${val}`} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontWeight: 700, paddingTop: '10px'}}/>
                      <Bar dataKey="Ingresos" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Anuladas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- VISTA USUARIOS (NUEVA - SOLO ADMIN) --- */}
        {vista === 'usuarios' && currentUser?.role === 'ADMIN' && (
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in">
            <div className="p-10 bg-slate-50 border-b flex justify-between items-center">
              <div><h2 className="text-3xl font-black text-slate-800">Gestión de Personal</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Control de accesos y perfiles médicos</p></div>
              <button onClick={() => setShowAddUserModal(true)} className="bg-cyan-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-lg hover:bg-cyan-700 transition-all"><Plus/> Nuevo Usuario</button>
            </div>
            <div className="p-8">
               <div className="flex gap-4 mb-8">
                 <button onClick={() => setFiltroRol('')} className={`px-6 py-3 rounded-xl font-black text-xs ${filtroRol === '' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Todos</button>
                 <button onClick={() => setFiltroRol('RECEPCION')} className={`px-6 py-3 rounded-xl font-black text-xs ${filtroRol === 'RECEPCION' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Recepción</button>
                 <button onClick={() => setFiltroRol('CONTADOR')} className={`px-6 py-3 rounded-xl font-black text-xs ${filtroRol === 'CONTADOR' ? 'bg-cyan-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Contadores</button>
               </div>
               <div className="overflow-hidden border rounded-[2rem]">
                 <table className="w-full text-sm">
                    <thead className="text-slate-400 uppercase font-black text-[10px] tracking-widest bg-slate-50 border-b">
                      <tr><th className="p-6 text-left">Colaborador</th><th className="p-6 text-center">Usuario</th><th className="p-6 text-center">Edad</th><th className="p-6 text-center">Rol</th><th className="p-6 text-center">Gestión</th></tr>
                    </thead>
                    <tbody className="divide-y font-bold text-slate-700">
                      {userList.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shadow-inner flex items-center justify-center">
                              {u.foto ? <img src={u.foto} className="w-full h-full object-cover"/> : <span className="text-slate-400 text-xs font-black">{getInitials(u.nombre_completo)}</span>}
                            </div>
                            <div>
                                <p>{u.nombre_completo}</p>
                                <p className="text-[10px] text-slate-400 font-bold">ID: #{u.id}</p>
                            </div>
                          </td>
                          <td className="text-center text-slate-400">{u.username}</td>
                          <td className="text-center">{u.edad} años</td>
                          <td className="text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : u.role === 'RECEPCION' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>{u.role}</span></td>
                          
                          <td className="p-6 text-center">
                            <div className="flex justify-center gap-2">
                              {/* BOTÓN EDITAR */}
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditProfileForm({
                                    username: u.username,
                                    nombre_completo: u.nombre_completo, 
                                    password: '',
                                    foto: u.foto || '',
                                    edad: u.edad
                                  });
                                  setVistaModal('editar');
                                }}
                                className="text-slate-300 hover:text-cyan-600 transition-colors"
                              >
                                <Settings size={20}/>
                              </button>
                              {/* BOTÓN ELIMINAR */}
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={20}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* --- VISTA EMISIÓN (IGUAL A TU CÓDIGO - RESTAURADA EMPRESA/FECHA) --- */}
        {vista === 'emision' && (currentUser?.role === 'ADMIN' || currentUser?.role === 'RECEPCION') && (
          <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in">
            <div className="bg-cyan-50 p-6 flex justify-between items-center border-b border-cyan-100">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-3 rounded-2xl shadow-sm text-cyan-600"><ReceiptText/></div>
                    <div><h2 className="text-xl font-black text-slate-800">Emisión de Comprobantes</h2><p className="text-xs text-slate-400 font-bold">Suba el ticket de caja para autocompletar.</p></div>
                </div>
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="application/pdf"/>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-cyan-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-cyan-700 transition-all flex items-center gap-2 text-sm uppercase">📂 Subir PDF</button>
                </div>
            </div>

            {/* SECCIÓN PRESERVADA: Empresa y Fecha */}
            <div className="bg-slate-800 p-8 text-white flex justify-between items-center gap-6 flex-wrap">
              <div className="flex-grow">
                <label className="text-[10px] font-black text-cyan-400 uppercase mb-2 block tracking-widest">Empresa Emisora de Comprobante</label>
                <select value={empresaIndex} onChange={(e) => setEmpresaIndex(parseInt(e.target.value))} className="w-full bg-slate-700 border-none text-white text-lg rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-cyan-500">
                    {EMPRESAS.map((emp, index) => (<option key={emp.ruc} value={index}>{emp.razon_social} - {emp.ruc}</option>))}
                </select>
              </div>
              <div className="w-full md:w-auto">
                 <label className="text-[10px] font-black text-cyan-400 uppercase mb-2 block tracking-widest">Fecha de Emisión</label>
                 <input type="date" value={fechaEmision} min={minDateStr} max={maxDateStr} onChange={(e) => setFechaEmision(e.target.value)} className="w-full bg-slate-700 border-none text-white text-lg rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-cyan-500"/>
              </div>
            </div>

            <div className="p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-12">
                    <section className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 shadow-inner">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2"><User size={14} className="text-cyan-600"/> Datos del Cliente</h3>
                            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                                <button onClick={() => setTipoDoc('03')} className={`px-6 py-2 rounded-xl font-black text-[10px] transition-all ${tipoDoc === '03' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400'}`}>BOLETA</button>
                                <button onClick={() => setTipoDoc('01')} className={`px-6 py-2 rounded-xl font-black text-[10px] transition-all ${tipoDoc === '01' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400'}`}>FACTURA</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex flex-col gap-2">
                                <input value={clienteDoc} onChange={(e) => { const v = e.target.value, max = tipoDoc === '01' ? 11 : 8; /^\d*$/.test(v) && v.length <= max && setClienteDoc(v); }} className="p-5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm text-lg" placeholder={tipoDoc === '01' ? 'RUC' : 'DNI'}/>
                                {avisoRuc && <p className="text-[9px] text-red-500 font-bold ml-2">{avisoRuc}</p>}
                            </div>
                            <input value={clienteNombre} onChange={handleNombreChange} onBlur={completarPuntos} className="md:col-span-2 p-5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm text-lg" placeholder="Nombre o Razón Social"/>
                            <input value={clienteDireccion} onChange={(e) => setClienteDireccion(e.target.value)} className="md:col-span-3 p-5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm" placeholder="Dirección Fiscal"/>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs ml-4">Detalle de Venta</h3>
                        <div className="flex flex-col md:flex-row gap-4 bg-cyan-50/40 p-8 rounded-[2.5rem] border border-cyan-100 items-end">
                            <div className="flex-grow flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Descripción</label><input value={tempProducto} onChange={e => setTempProducto(e.target.value)} className="p-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm"/></div>
                            <div className="w-24 flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Cant.</label><input type="number" min="1" value={tempCantidad} onChange={e => setTempCantidad(Number(e.target.value))} className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-center"/></div>
                            <div className="w-36 flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Precio</label><input type="number" min="0.01" step="0.01" value={tempPrecio} onChange={e => setTempPrecio(e.target.value)} className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-right shadow-sm"/></div>
                            <button onClick={procesarItem} className={`p-5 rounded-2xl shadow-xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest ${editandoId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}>{editandoId ? <><Edit2 size={18}/> Guardar Cambios</> : <Plus/>}</button>
                        </div>

                        {items.length > 0 && (
                            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="p-5 text-center">Cant</th><th className="p-5 text-left">Producto / Servicio</th><th className="p-5 text-right">Unitario</th><th className="p-5 text-right">Subtotal</th><th className="p-5 text-center">Gestión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {items.map(item => (
                                            <tr key={item.id} className="font-bold text-slate-700 hover:bg-slate-50">
                                                <td className="p-5 text-center text-cyan-600 font-black">{item.cantidad}</td>
                                                <td className="p-5">{item.producto}</td>
                                                <td className="p-5 text-right">{formatoMoneda.format(item.precio_unitario)}</td>
                                                <td className="p-5 text-right font-black text-slate-900">{formatoMoneda.format(item.total)}</td>
                                                <td className="p-5">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => prepararEdicion(item)} className="p-2 text-amber-500 hover:bg-amber-100 rounded-xl transition-all"><Edit2 size={16}/></button>
                                                        <button onClick={() => eliminarItem(item.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-xl transition-all"><Trash2 size={16}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 sticky top-32 border-t-[12px] border-cyan-500">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Resumen de Comprobante</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between text-sm opacity-50"><span>Base Imponible</span><span>{formatoMoneda.format(totalGeneral / 1.18)}</span></div>
                            <div className="flex justify-between text-sm opacity-50 border-b border-white/5 pb-4"><span>I.G.V. (18%)</span><span>{formatoMoneda.format(totalGeneral - (totalGeneral / 1.18))}</span></div>
                            <div className="flex justify-between items-end pt-4">
                                <span className="font-black text-xl tracking-tighter">TOTAL NETO</span>
                                <span className="text-5xl font-black text-cyan-400 tracking-tighter">{formatoMoneda.format(totalGeneral)}</span>
                            </div>
                        </div>
                        <button onClick={iniciarEmision} className="w-full py-6 bg-cyan-500 text-slate-900 font-black rounded-2xl shadow-xl hover:bg-cyan-400 transition-all uppercase tracking-widest text-xs">EMITIR COMPROBANTE ✅</button>
                        {totalPdfDetectado !== null && (
                          <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/10"><Info className="text-cyan-400" size={18}/><p className="text-[10px] font-bold text-slate-400 uppercase">Detectado en Ticket: <span className="text-white">{formatoMoneda.format(totalPdfDetectado)}</span></p></div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* --- REPORTE CONTABLE (IGUAL A TU CÓDIGO - 10 COLUMNAS RESTAURADAS) --- */}
        {vista === 'reporte' && (currentUser?.role === 'ADMIN' || currentUser?.role === 'CONTADOR' || currentUser?.role === 'RECEPCION') && (
            <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in">
                <div className="p-10 bg-slate-50 border-b border-slate-100 flex flex-col lg:row justify-between items-center gap-8">
                    <div><h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3"><FileSpreadsheet className="text-cyan-600" size={32}/> Reporte Contable</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Auditoría General de Documentos Emitidos</p></div>
                    <div className="flex flex-wrap justify-end gap-3">
                        <div className="flex bg-white p-2 rounded-2xl border shadow-sm items-center">
                          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="px-3 py-2 font-black text-xs outline-none bg-transparent"/>
                          <span className="text-slate-300 px-1">/</span>
                          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="px-3 py-2 font-black text-xs outline-none bg-transparent"/>
                        </div>
                        {currentUser?.role === 'RECEPCION' ? (
                          <button
                            onClick={exportarGenerico}
                            className="bg-green-600 text-white px-6 py-4 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-green-700 transition-all uppercase"
                          >
                            <Download size={16}/> EXPORTAR REPORTE
                          </button>
                        ) : (
                          <button
                            onClick={exportarContasis}
                            className="bg-cyan-600 text-white px-6 py-4 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg hover:bg-cyan-700 transition-all uppercase"
                          >
                            <FileSpreadsheet size={16}/> EXPORTAR CONTASIS
                          </button>  
                        )}
                        <button onClick={cargarHistorial} className="bg-slate-200 text-slate-600 px-5 py-4 rounded-2xl font-black hover:bg-slate-300">🔄</button>
                    </div>
                </div>

                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <select value={filtroEmpresaRuc} onChange={(e) => setFiltroEmpresaRuc(e.target.value)} className="p-5 bg-slate-100 rounded-2xl font-black text-xs border-none outline-none focus:ring-2 focus:ring-cyan-500 text-slate-600">
                        <option value="">🏢 Todas las Empresas Emisoras</option>
                        {EMPRESAS.map(e => <option key={e.ruc} value={e.ruc}>{e.razon_social}</option>)}
                    </select>
                    <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="p-5 bg-slate-100 rounded-2xl font-black text-xs border-none outline-none focus:ring-2 focus:ring-cyan-500 text-slate-600">
                        <option value="">📝 Todos los Tipos</option>
                        <option value="VENTA">💰 Solo Venta</option>
                        <option value="NOTA_CREDITO">↩️ Solo Notas de Crédito</option>
                    </select>
                    <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="p-5 bg-slate-100 rounded-2xl font-black text-xs border-none outline-none focus:ring-2 focus:ring-cyan-500 text-slate-600">
                        <option value="">🟢 Todos los Estados</option>
                        <option value="FIRMADO">✅ Válidos</option>
                        <option value="ANULADO">❌ Anulado</option>
                    </select>
                    <input placeholder="🔍 Buscar por nombre o número de documento del cliente..." value={busquedaTexto} onChange={(e) => setBusquedaTexto(e.target.value)} className="p-5 bg-slate-100 rounded-2xl font-bold text-xs border-none outline-none focus:ring-2 focus:ring-cyan-500"/>
                  </div>

                  <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-sm">
                      <table className="w-full text-[11px] font-bold">
                          <thead className="text-slate-400 uppercase font-black tracking-widest bg-slate-50 border-b">
                              <tr>
                                  <th className="p-6 text-left">Fecha</th>
                                  <th className="p-6 text-left">Cliente</th>
                                  <th className="p-6 text-center">N° Doc</th>
                                  <th className="p-6 text-right">Total</th>
                                  <th className="p-6 text-center">Tipo</th>
                                  <th className="p-6 text-center">Estado</th>
                                  <th className="p-6 text-center">Docs</th>
                                  <th className="p-6 text-center">Ticket de Venta</th>
                                  <th className="p-6 text-center">Ref. Ticket</th>
                                  <th className="p-6 text-center">Gestión</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {historialFiltrado().map(t => (
                                  <tr key={t.id} className={`hover:bg-cyan-50/30 transition-all ${t.anulado ? 'opacity-40 grayscale italic' : ''}`}>
                                      <td className="p-6"><div>{new Date(t.created_at).toLocaleDateString()}</div><div className="text-[9px] text-slate-400">{new Date(t.created_at).toLocaleTimeString()}</div></td>
                                      <td className="p-6"><div>{t.cliente_data?.nombre || 'Público'}</div><div className="text-[9px] text-slate-400">{t.cliente_data?.dni}</div></td>
                                      <td className="p-6 text-center text-slate-500 font-mono">{extraerSerieNumero(t.filename)}</td>
                                      <td className={`p-6 text-right font-black text-sm ${t.total_venta < 0 ? 'text-red-500' : 'text-slate-900'}`}>{formatoMoneda.format(t.total_venta)}</td>
                                      <td className="p-6 text-center"><span className={`px-2 py-1 rounded-lg text-[9px] ${t.total_venta < 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{t.total_venta < 0 ? 'NOTA CRÉDITO' : 'VENTA'}</span></td>
                                      <td className="p-6 text-center"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[9px] font-black">{t.estado}</span></td>
                                      <td className="p-6 text-center">{t.filename && <button onClick={() => descargarTicket(t.filename, t.id)} className="text-cyan-600 hover:text-cyan-800 flex items-center justify-center gap-1 mx-auto"><FileText size={14}/> PDF</button>}</td>
                                      <td className="p-6 text-center"><span className="bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-[10px] font-black border border-cyan-100">{t.nro_ticket || '-'}</span></td>
                                      <td className="p-6 text-center text-[9px] text-slate-400 font-mono">{t.ticket_origen || '-'}</td>
                                      <td className="p-6 text-center">
                                          {!t.anulado && t.estado === 'FIRMADO' && (
                                            <button onClick={() => anularComprobante(t)} className="text-red-500 hover:text-red-700 font-black text-[10px] border border-red-200 px-3 py-1 rounded-xl transition-all">ANULAR</button>
                                          )}
                                          {t.anulado && <span className="text-slate-400 italic text-[10px] font-bold">YA ANULADO</span>}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                </div>
            </div>
        )}
      </main>

      {/* ==========================================
          🛡️ MODALES (USUARIOS Y PERFIL)
          ========================================== */}
      
      {/* MODAL CREAR USUARIO (SOLO ADMIN) */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in">
             <div className="bg-cyan-600 p-8 text-white flex justify-between items-center">
                <div><h3 className="text-2xl font-black uppercase tracking-tighter leading-none">Nuevo Personal</h3><p className="text-[10px] font-bold opacity-70 mt-2 uppercase tracking-widest">Registre un nuevo colaborador</p></div>
                <button onClick={() => setShowAddUserModal(false)} className="bg-white/20 p-2 rounded-xl hover:bg-white/30 transition-all"><XCircle/></button>
             </div>
             <form onSubmit={handleCreateUser} className="p-10 space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Completo</label><input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={newUserForm.nombre_completo} onChange={e => setNewUserForm({...newUserForm, nombre_completo: e.target.value})}/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Edad</label><input type="number" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={newUserForm.edad} onChange={e => setNewUserForm({...newUserForm, edad: parseInt(e.target.value)})}/></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Rol de Usuario</label>
                  <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}>
                    <option value="RECEPCION">Recepción</option><option value="CONTADOR">Contador</option><option value="ADMIN">Administrador</option>
                  </select></div>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre de Usuario (Login)</label><input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})}/></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Contraseña Inicial</label><input type="password" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}/></div>
                <button type="submit" className="w-full py-5 bg-cyan-600 text-white font-black rounded-2xl shadow-xl hover:bg-cyan-700 transition-all uppercase tracking-widest text-xs">Registrar Colaborador ✅</button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL VER PERFIL */}
      {vistaModal === 'perfil' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in">
             <div className="bg-slate-900 p-10 text-center relative">
                <button onClick={() => setVistaModal(null)} className="absolute right-6 top-6 text-white/50 hover:text-white transition-colors"><XCircle/></button>
                <div className="w-32 h-32 rounded-full border-4 border-cyan-500 mx-auto overflow-hidden bg-white mb-6 shadow-2xl">
                  {currentUser?.foto ? <img src={currentUser.foto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl text-cyan-600 font-black">{getInitials(currentUser?.nombre_completo || '')}</div>}
                </div>
                <h3 className="text-white font-black text-2xl tracking-tighter">{currentUser?.nombre_completo}</h3>
                <p className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest mt-1">{currentUser?.role}</p>
             </div>
             <div className="p-10 space-y-6">
                <div className="flex justify-between border-b border-slate-50 pb-4"><span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Usuario</span><span className="font-black text-slate-800">{currentUser?.username}</span></div>
                <div className="flex justify-between border-b border-slate-50 pb-4"><span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Edad Actual</span><span className="font-black text-slate-800">{currentUser?.edad} años</span></div>
                <button onClick={() => setVistaModal('editar')} className="w-full py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest">Editar Mi Información</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR INFORMACIÓN */}
      {vistaModal === 'editar' && (
        <div className="fixed inset-0 bg-slate-900/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in">
             <div className="bg-cyan-600 p-8 text-white flex justify-between items-center">
                <div><h3 className="text-2xl font-black uppercase tracking-tighter">Editar Perfil</h3><p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">Mantenga sus datos al día</p></div>
                <button onClick={() => setVistaModal('perfil')} className="bg-white/20 p-2 rounded-xl"><XCircle/></button>
             </div>
             <form onSubmit={handleUpdateProfile} className="p-10 space-y-6">
                <div className="flex justify-center mb-8">
                  <label className="relative group cursor-pointer">
                    <div className="w-28 h-28 rounded-full bg-slate-100 overflow-hidden border-4 border-white shadow-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-all">
                      {editProfileForm.foto ? <img src={editProfileForm.foto} className="w-full h-full object-cover"/> : <Camera size={32}/>}
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFotoUpload}/>
                    <div className="absolute right-0 bottom-0 bg-cyan-600 text-white p-2.5 rounded-full shadow-lg border-2 border-white"><Plus size={14}/></div>
                  </label>
                </div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Completo</label><input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={editProfileForm.nombre_completo} onChange={e => setEditProfileForm({...editProfileForm, nombre_completo: e.target.value})}/></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre de Usuario</label><input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={editProfileForm.username} onChange={e => setEditProfileForm({...editProfileForm, username: e.target.value})}/></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nueva Contraseña</label><input type="password" placeholder="••••••••" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-cyan-500 outline-none" value={editProfileForm.password} onChange={e => setEditProfileForm({...editProfileForm, password: e.target.value})}/></div>
                <button type="submit" className="w-full py-5 bg-cyan-600 text-white font-black rounded-2xl shadow-xl hover:bg-cyan-700 transition-all uppercase tracking-widest text-xs">Guardar Cambios 💾</button>
             </form>
          </div>
        </div>
      )}

      {/* MODALES GLOBALES PRESERVADOS */}
      {mostrarModalConfirmacion && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-white animate-in zoom-in duration-300">
                <div className="bg-cyan-600 p-8 text-white text-center"><CheckCircle2 size={48} className="mx-auto mb-4 opacity-50"/><h3 className="text-2xl font-black uppercase tracking-tighter">Confirmar Emisión</h3></div>
                <div className="p-10 space-y-6">
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4 font-bold">
                        <div className="flex justify-between border-b pb-3"><span className="text-slate-400 text-[10px] uppercase">Cliente</span><span className="text-slate-800 text-sm">{clienteNombre.slice(0,25)}...</span></div>
                        <div className="flex justify-between items-center"><span className="text-slate-400 text-[10px] uppercase">Importe Total</span><span className="text-2xl font-black text-cyan-600">{formatoMoneda.format(totalGeneral)}</span></div>
                    </div>
                    <div className="flex gap-4"><button onClick={() => setMostrarModalConfirmacion(false)} className="flex-1 py-5 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Atrás</button><button onClick={confirmarYEmitir} className="flex-1 py-5 bg-cyan-600 text-white font-black rounded-2xl shadow-xl hover:bg-cyan-700 transition-all uppercase text-xs tracking-widest transform active:scale-95">Emitir ✅</button></div>
                </div>
            </div>
        </div>
      )}

      {modalAlerta.abierto && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-sm w-full overflow-hidden border-t-[12px] border-cyan-600 animate-in zoom-in duration-300">
            <div className="p-10 text-center"><div className={`w-24 h-24 ${modalAlerta.tipo === 'warning' ? 'bg-amber-100 text-amber-500' : 'bg-cyan-100 text-cyan-600'} rounded-full flex items-center justify-center mx-auto mb-6`}>{modalAlerta.tipo === 'warning' ? <AlertTriangle size={40}/> : <Info size={40}/>}</div><h3 className="text-2xl font-black text-slate-800 mb-3 leading-none tracking-tighter">{modalAlerta.titulo}</h3><p className="text-slate-500 text-sm font-bold leading-relaxed">{modalAlerta.mensaje}</p></div>
            <div className="bg-slate-50 p-8 flex gap-4">{modalAlerta.accion && (<button onClick={() => setModalAlerta(prev => ({ ...prev, abierto: false }))} className="flex-1 py-4 text-slate-400 font-black hover:bg-slate-200 rounded-2xl uppercase text-[10px] tracking-widest">Atrás</button>)}<button onClick={() => { if (modalAlerta.accion) modalAlerta.accion(); setModalAlerta(prev => ({ ...prev, abierto: false })); }} className="flex-1 py-4 bg-cyan-600 text-white font-black rounded-2xl shadow-xl hover:bg-cyan-700 uppercase text-[10px] tracking-widest">Continuar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}