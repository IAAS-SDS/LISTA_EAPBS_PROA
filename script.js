const API_URL = "https://script.google.com/macros/s/AKfycby8YcBUSQFA_Z_mqFWDexjKMnHWzTQy_t0NrsvdgnAyDZz9xpt6gKjSR9Bez2EIdu9Cpw/exec";

const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzjJNyPAibmzo8X2WB83s0uXVAYs0MlYWwRSaa_jqmUb3p0qNExvB50aWFIFQYVNyCa8g/exec";
const inputIps = document.getElementById("ips_visitada");
const inputCodigoHabilitacion = document.getElementById("codigo_habilitacion_ips");
const listaIps = document.getElementById("resultadosIps");
const camposSoloLetras = document.querySelectorAll(".solo-letras");
const camposSoloNumeros = document.querySelectorAll(".solo-numeros");
const selectsRequeridos = document.querySelectorAll("select[required]");
const selectsEstadoCumplimiento = document.querySelectorAll(".estado-cumplimiento");
const botonEnviarFormulario = document.getElementById("btnEnviarFormulario");
const inputFechaVisitaSeguimiento = document.getElementById("fecha_visita_seguimiento");
const VALIDAR_CAMPOS_ANTES_DE_ENVIAR = true;

let timer = null;

inputIps.addEventListener("input", () => {
  clearTimeout(timer);
  const q = inputIps.value.trim();
  actualizarCodigoHabilitacionDesdeIps(q);

  if (q.length < 2) {
    listaIps.innerHTML = "";
    listaIps.style.display = "none";
    return;
  }

  timer = setTimeout(() => buscarIps(q), 250);
});

camposSoloLetras.forEach(campo => {
  campo.addEventListener("input", () => {
    const limpio = campo.value.replace(/[^\p{L}\s]/gu, "");
    if (campo.value !== limpio) {
      campo.value = limpio;
    }
  });
});

camposSoloNumeros.forEach(campo => {
  campo.addEventListener("input", () => {
    const soloDigitos = campo.value.replace(/\D/g, "").slice(0, 10);
    const formateado = formatearTelefono(soloDigitos);
    if (campo.value !== formateado) {
      campo.value = formateado;
    }
  });
});

selectsRequeridos.forEach(select => {
  select.setCustomValidity(select.value ? "" : "Seleccione una opción");

  select.addEventListener("change", () => {
    validarSelectObligatorio(select);
  });

  select.addEventListener("blur", () => {
    validarSelectObligatorio(select);
  });
});

selectsEstadoCumplimiento.forEach(select => {
  select.addEventListener("change", () => {
    recalcularFilaEvaluacion(select);
    recalcularSubtotalEvaluacion();
    limpiarEstadoFaltante(select);
  });
});

if (botonEnviarFormulario) {
  botonEnviarFormulario.addEventListener("click", manejarEnvioFormulario);
}

async function buscarIps(q) {
  try {
    const res = await fetch(`${API_URL}?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      listaIps.innerHTML = "<li>No se encontraron resultados</li>";
      listaIps.style.display = "block";
      return;
    }

    listaIps.innerHTML = data
      .map(item => `<li data-valor="${escapeHtml(item)}">${escapeHtml(item)}</li>`)
      .join("");

    listaIps.style.display = "block";

    document.querySelectorAll("#resultadosIps li").forEach(li => {
      li.addEventListener("click", () => {
        const valor = li.getAttribute("data-valor");
        inputIps.value = valor;
        actualizarCodigoHabilitacionDesdeIps(valor);
        listaIps.innerHTML = "";
        listaIps.style.display = "none";
      });
    });
  } catch (error) {
    listaIps.innerHTML = "<li>Error al consultar resultados</li>";
    listaIps.style.display = "block";
  }
}

document.addEventListener("click", function (e) {
  if (!e.target.closest(".autocomplete-wrapper")) {
    listaIps.style.display = "none";
  }
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function validarSelectObligatorio(select) {
  const valido = select.value.trim() !== "";
  select.setCustomValidity(valido ? "" : "Seleccione una opción");
  select.classList.toggle("invalido", !valido);
}

function limpiarEstadoFaltante(campo) {
  campo.classList.remove("campo-faltante");
}

function actualizarCodigoHabilitacionDesdeIps(textoIps) {
  if (!inputCodigoHabilitacion) {
    return;
  }

  const texto = (textoIps || "").trim();
  const match = texto.match(/^\s*(\d{6,})\s*-/);
  inputCodigoHabilitacion.value = match ? match[1] : "";
}

function establecerFechaActual() {
  if (!inputFechaVisitaSeguimiento) {
    return;
  }

  const hoy = new Date();
  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");
  inputFechaVisitaSeguimiento.value = `${year}-${month}-${day}`;
}

function formatearTelefono(digitos) {
  if (digitos.length <= 3) {
    return digitos;
  }

  if (digitos.length <= 6) {
    return `${digitos.slice(0, 3)}-${digitos.slice(3)}`;
  }

  return `${digitos.slice(0, 3)}-${digitos.slice(3, 6)}-${digitos.slice(6, 10)}`;
}

function recalcularFilaEvaluacion(selectEstado) {
  const fila = selectEstado.closest("tr");
  if (!fila) {
    return;
  }

  const celdas = fila.querySelectorAll("td");
  if (celdas.length < 5) {
    return;
  }

  const celdaPonderacion = celdas[2];
  const celdaPuntajeObtenido = celdas[4];
  const item = (celdas[0].textContent || "").trim();
  const ponderacion = parseNumeroEs(celdaPonderacion.textContent);
  const reglasEspeciales = {
    "1": { "Cumple": 2.5, "Cumplimiento Parcial": 1.25, "No Cumple": 0, "No Aplica": 2.5 },
    "1.2": { "Cumple": 2.5, "Cumplimiento Parcial": 1.25, "No Cumple": 0, "No Aplica": 2.5 },
    "1.3": { "Cumple": 2.5, "Cumplimiento Parcial": 1.25, "No Cumple": 0, "No Aplica": 2.5 },
    "1.5": { "Cumple": 2.5, "Cumplimiento Parcial": 1.25, "No Cumple": 0, "No Aplica": 2.5 },
    "1.1.a": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.b": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.c": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.d": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.e": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.f": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.g": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.h": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 },
    "1.1.i": { "Cumple": 1, "Cumplimiento Parcial": 0.5, "No Cumple": 0, "No Aplica": 1 }
  };

  const reglaItem = reglasEspeciales[item];
  if (reglaItem && Object.prototype.hasOwnProperty.call(reglaItem, selectEstado.value)) {
    celdaPuntajeObtenido.textContent = formatearNumeroEs(reglaItem[selectEstado.value]);
    actualizarColorPuntaje(celdaPuntajeObtenido, selectEstado.value);
    return;
  }

  let factor = 0;
  switch (selectEstado.value) {
    case "Cumple":
      factor = 1;
      break;
    case "Cumplimiento Parcial":
      factor = 0.5;
      break;
    case "No Cumple":
    case "No Aplica":
    default:
      factor = 0;
      break;
  }

  const obtenido = ponderacion * factor;
  celdaPuntajeObtenido.textContent = formatearNumeroEs(obtenido);
  actualizarColorPuntaje(celdaPuntajeObtenido, selectEstado.value);
}

function recalcularSubtotalEvaluacion() {
  const filasSubtotal = document.querySelectorAll(".fila-total[data-subtotal]");
  let totalFinal = 0;

  filasSubtotal.forEach(filaSubtotal => {
    const sectionId = filaSubtotal.dataset.subtotal;
    const filasSeccion = document.querySelectorAll(`tr[data-section="${sectionId}"]`);
    let subtotal = 0;

    filasSeccion.forEach(fila => {
      const celdas = fila.querySelectorAll("td");
      if (celdas.length < 5) {
        return;
      }

      subtotal += parseNumeroEs(celdas[4].textContent);
    });

    const celdaSubtotal = filaSubtotal.querySelector(".valor-total");
    if (celdaSubtotal) {
      const subtotalFormateado = formatearNumeroEs(subtotal);
      celdaSubtotal.textContent = subtotalFormateado;
      actualizarResumenComponente(sectionId, subtotalFormateado);
    }

    totalFinal += subtotal;
  });

  actualizarResumenFinal(totalFinal);
}

function parseNumeroEs(texto) {
  const normalizado = (texto || "").trim().replace(",", ".");
  const numero = Number.parseFloat(normalizado);
  return Number.isNaN(numero) ? 0 : numero;
}

function formatearNumeroEs(valor) {
  const redondeado = Math.round((valor + Number.EPSILON) * 100) / 100;
  let texto = redondeado.toFixed(2).replace(".", ",");
  texto = texto.replace(/,00$/, "").replace(/(\,\d)0$/, "$1");
  return texto;
}

function actualizarResumenComponente(sectionId, valorFormateado) {
  const celdaResumen = document.querySelector(`.resumen-valor[data-resumen="${sectionId}"]`);
  if (celdaResumen) {
    celdaResumen.textContent = valorFormateado;
  }
}

function actualizarResumenFinal(total) {
  const totalFinalResumen = document.getElementById("totalFinalResumen");
  const interpretacionResumen = document.getElementById("interpretacionResumen");
  const accionesResumen = document.getElementById("accionesResumen");

  if (totalFinalResumen) {
    totalFinalResumen.textContent = formatearNumeroEs(total);
  }

  if (interpretacionResumen) {
    interpretacionResumen.textContent = obtenerInterpretacion(total);
  }

  if (accionesResumen) {
    accionesResumen.textContent = obtenerAcciones(total);
  }
}

function obtenerCamposFormulario() {
  return Array.from(document.querySelectorAll(`
    #razon_social_asegurado,
    #tipo_aseguradora,
    #nombre_seguimiento,
    #tel_contacto,
    #cargo_visita,
    #correo_electronico,
    #ips_visitada,
    #naturaleza_ips,
    #codigo_habilitacion_ips,
    #complejidad_servicios_salud,
    #fecha_visita_seguimiento,
    #nombre_recibe_visita,
    #correo_institucional,
    #cargo_recibe_visita,
    #tel_contacto_institucional,
    #programa_evaluar,
    .estado-cumplimiento
  `));
}

function validarCampo(campo) {
  const valor = (campo.value || "").trim();
  const esValido = valor !== "";
  campo.classList.toggle("campo-faltante", !esValido);
  return esValido;
}

function construirPayload() {
  return {
    datosGenerales: {
      razonSocialAsegurado: document.getElementById("razon_social_asegurado")?.value || "",
      tipoAseguradora: document.getElementById("tipo_aseguradora")?.value || "",
      nombreSeguimiento: document.getElementById("nombre_seguimiento")?.value || "",
      telContacto: document.getElementById("tel_contacto")?.value || "",
      cargoVisita: document.getElementById("cargo_visita")?.value || "",
      correoElectronico: document.getElementById("correo_electronico")?.value || "",
      ipsVisitada: document.getElementById("ips_visitada")?.value || "",
      naturalezaIps: document.getElementById("naturaleza_ips")?.value || "",
      codigoHabilitacionIps: document.getElementById("codigo_habilitacion_ips")?.value || "",
      complejidadServiciosSalud: document.getElementById("complejidad_servicios_salud")?.value || "",
      fechaVisitaSeguimiento: document.getElementById("fecha_visita_seguimiento")?.value || "",
      nombreRecibeVisita: document.getElementById("nombre_recibe_visita")?.value || "",
      correoInstitucional: document.getElementById("correo_institucional")?.value || "",
      cargoRecibeVisita: document.getElementById("cargo_recibe_visita")?.value || "",
      telContactoInstitucional: document.getElementById("tel_contacto_institucional")?.value || "",
      programaEvaluar: document.getElementById("programa_evaluar")?.value || ""
    },
    componentes: obtenerDetalleComponentes(),
    totalFinal: document.getElementById("totalFinalResumen")?.textContent || "",
    interpretacion: document.getElementById("interpretacionResumen")?.textContent || "",
    acciones: document.getElementById("accionesResumen")?.textContent || ""
  };
}

function obtenerDetalleComponentes() {
  const filas = Array.from(document.querySelectorAll(".tabla-evaluacion tbody tr[data-section]"));

  return filas.map(fila => {
    const celdas = fila.querySelectorAll("td");
    const campoObservacion = fila.querySelector(".observacion-input");
    const selectEstado = fila.querySelector(".estado-cumplimiento");

    return {
      numeroComponente: celdas[0]?.textContent.trim() || "",
      puntaje: selectEstado?.value || "",
      puntajeObtenido: celdas[4]?.textContent.trim() || "0",
      observaciones: campoObservacion?.value.trim() || ""
    };
  });
}

async function manejarEnvioFormulario() {
  if (VALIDAR_CAMPOS_ANTES_DE_ENVIAR) {
    const campos = obtenerCamposFormulario();
    let primerCampoInvalido = null;
    let formularioValido = true;

    campos.forEach(campo => {
      const esValido = validarCampo(campo);
      if (!esValido && !primerCampoInvalido) {
        primerCampoInvalido = campo;
      }

      formularioValido = formularioValido && esValido;
    });

    if (!formularioValido) {
      if (primerCampoInvalido && typeof primerCampoInvalido.focus === "function") {
        primerCampoInvalido.focus();
      }

      alert("Debes diligenciar todos los campos antes de enviar.");
      return;
    }
  }

  try {
    if (botonEnviarFormulario) {
      botonEnviarFormulario.disabled = true;
      botonEnviarFormulario.textContent = "Generando PDF...";
    }

    await generarPdfFormulario();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    alert("No fue posible generar el PDF del formulario.");
    return;
  } finally {
    if (botonEnviarFormulario) {
      botonEnviarFormulario.disabled = false;
      botonEnviarFormulario.textContent = "Enviar";
    }
  }

  const payload = construirPayload();
  console.log("Formulario listo para enviar:", payload);

  try {
    await enviarPayloadAGoogleSheets(payload);

    if (SHEETS_WEBHOOK_URL) {
      alert("PDF generado, descargado y datos enviados correctamente a Google Sheets.");
    } else {
      alert("PDF generado y descargado correctamente. Falta configurar la URL de Google Sheets para enviar los datos.");
    }
  } catch (error) {
    console.error("Error al enviar datos a Google Sheets:", error);
    alert("PDF generado correctamente, pero no fue posible enviar los datos a Google Sheets.");
  }
}

function generarPdfFormulario() {
  if (typeof window.html2canvas === "undefined" || typeof window.jspdf === "undefined") {
    return Promise.reject(new Error("Las librerías para generar el PDF no están disponibles."));
  }

  const contenedor = document.querySelector(".contenedor");
  if (!contenedor) {
    return Promise.reject(new Error("No se encontró el contenido del formulario."));
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `formulario-proa-${fecha}.pdf`;

  const { jsPDF } = window.jspdf;

  return window.html2canvas(contenedor, {
    scale: 2.2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollY: 0,
    letterRendering: true,
    windowWidth: contenedor.scrollWidth,
    windowHeight: contenedor.scrollHeight
  }).then(canvas => {
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const margin = 5;
    const pageWidth = 210;
    const pageHeight = (imgHeight * pageWidth) / imgWidth + margin * 2;
    const orientation = pageHeight > pageWidth ? "portrait" : "landscape";

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [pageHeight, pageWidth],
      compress: true
    });

    const renderWidth = pageWidth - margin * 2;
    const renderHeight = (imgHeight * renderWidth) / imgWidth;

    const imgData = canvas.toDataURL("image/jpeg", 0.72);
    pdf.addImage(imgData, "JPEG", margin, margin, renderWidth, renderHeight);
    pdf.save(nombreArchivo);
  });
}

async function enviarPayloadAGoogleSheets(payload) {
  if (!SHEETS_WEBHOOK_URL) {
    return null;
  }

  const respuesta = await fetch(SHEETS_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  return respuesta;
}

function obtenerInterpretacion(total) {
  if (total === 0) {
    return "";
  }

  if (total <= 60) {
    return "INADECUADO";
  }

  if (total <= 70) {
    return "BÁSICO";
  }

  if (total <= 90) {
    return "INTERMEDIO";
  }

  return "AVANZADO";
}

function obtenerAcciones(total) {
  if (total === 0) {
    return "";
  }

  if (total >= 91) {
    return "Mantener Procesos";
  }

  if (total >= 71) {
    return "Mantener y mejorar procesos";
  }

  if (total >= 61) {
    return "Realizar plan de mejora";
  }

  return "Establecer un plan de mejora con acciones inmediatas que permitan posicionar el programa en un nivel intermedio o avanzado.";
}

function inicializarCamposObservacion() {
  const filas = document.querySelectorAll(".tabla-evaluacion tbody tr");

  filas.forEach(fila => {
    const selectEstado = fila.querySelector(".estado-cumplimiento");
    if (!selectEstado) {
      return;
    }

    const celdas = fila.querySelectorAll("td");
    if (celdas.length < 6) {
      return;
    }

    const celdaObservacion = celdas[5];
    if (celdaObservacion.querySelector(".observacion-input")) {
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.className = "observacion-input";
    textarea.name = "observacion_item[]";
    textarea.placeholder = "Escriba observaciones...";
    celdaObservacion.appendChild(textarea);
  });
}

function actualizarColorPuntaje(celda, estado) {
  celda.classList.remove("estado-cumple", "estado-parcial", "estado-no-cumple", "estado-no-aplica");

  switch (estado) {
    case "Cumple":
      celda.classList.add("estado-cumple");
      break;
    case "Cumplimiento Parcial":
      celda.classList.add("estado-parcial");
      break;
    case "No Cumple":
      celda.classList.add("estado-no-cumple");
      break;
    case "No Aplica":
      celda.classList.add("estado-no-aplica");
      break;
    default:
      break;
  }
}

inicializarCamposObservacion();
establecerFechaActual();
selectsEstadoCumplimiento.forEach(recalcularFilaEvaluacion);
recalcularSubtotalEvaluacion();
