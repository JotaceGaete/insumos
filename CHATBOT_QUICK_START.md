# 🚀 Chatbot - Inicio Rápido

## ✅ Estado: IMPLEMENTADO Y FUNCIONANDO

El chatbot está **activo en todas las páginas** del sitio.

---

## 🎯 Cómo Usarlo

### 1. Abre cualquier página del sitio
```
http://localhost:3001/
```

### 2. Busca el botón flotante
Verás un botón circular con el ícono 💬 en la **esquina inferior derecha**

### 3. Haz clic para abrir
El widget del chat se desplegará con una animación suave

### 4. Escribe tu consulta
Ejemplos:
- "Shiny 722"
- "Muéstrame timbres en rojo"
- "Horarios de atención"
- "Información de envíos"

### 5. Recibe respuestas en tiempo real
El bot responderá con:
- ✅ Información de productos
- 🖼️ Imágenes desde R2
- 📋 Detalles de stock
- 💰 Precios
- 🎨 Colores disponibles

---

## 📍 Ubicación Visual

```
┌─────────────────────────────────────────┐
│                                         │
│  [Navbar]                               │
│                                         │
│                                         │
│  Contenido de la página                 │
│                                         │
│                                         │
│                                         │
│                              [💬]       │  ← Botón del chatbot
│                                         │
└─────────────────────────────────────────┘
```

Al hacer clic:

```
┌─────────────────────────────────────────┐
│                                         │
│  [Navbar]                               │
│                                         │
│                    ┌──────────────────┐ │
│  Contenido         │ 🤖 ARTEMA Bot│ │
│                    ├──────────────────┤ │
│                    │                  │ │
│                    │ [Mensajes aquí]  │ │
│                    │                  │ │
│                    ├──────────────────┤ │
│                    │ [Escribe aquí]   │ │
│                    └──────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🎨 Características Visuales

### Botón Flotante
- **Tamaño:** 56px × 56px
- **Color:** Gradiente indigo (#4F46E5)
- **Ícono:** 💬 (abierto) / ✕ (cerrado)
- **Hover:** Escala 110% + sombra

### Widget del Chat
- **Dimensiones:** 384px × 500px
- **Posición:** Fixed, esquina inferior derecha
- **Fondo:** Blanco con sombra elegante
- **Header:** Gradiente indigo → purple
- **Animación:** Slide-in desde abajo

---

## 💬 Ejemplos de Uso

### Consulta de Productos
```
Usuario: "Shiny 722"

Bot: El Shiny 722 está disponible en stock...
     [Muestra imagen del producto]
     Precio: $17.000
     Colores: Azul, Rojo, Negro, etc.
```

### Consulta con Color Específico
```
Usuario: "Shiny 722 en rojo"

Bot: El Shiny 722 en color rojo está disponible.
     [Muestra imagen del producto rojo]
     ✅ En stock (6 unidades)
```

### Información del Negocio
```
Usuario: "Horarios de atención"

Bot: Nuestros horarios son:
     Lunes a Viernes: 9:00 - 18:00
     Sábados: 10:00 - 14:00
     Domingos: Cerrado
```

---

## 🔧 Personalización Rápida

### Cambiar Posición del Botón

**Archivo:** `src/components/ChatInterface.tsx`

```tsx
// Línea ~173
// Actual: esquina inferior derecha
className="fixed bottom-4 right-4 ..."

// Cambiar a esquina inferior izquierda:
className="fixed bottom-4 left-4 ..."

// Cambiar a esquina superior derecha:
className="fixed top-4 right-4 ..."
```

### Cambiar Color del Botón

```tsx
// Línea ~175
// Actual: indigo
className="... bg-indigo-600 hover:bg-indigo-700 ..."

// Cambiar a azul:
className="... bg-blue-600 hover:bg-blue-700 ..."

// Cambiar a verde:
className="... bg-green-600 hover:bg-green-700 ..."
```

---

## 📱 Responsive

El chatbot se adapta automáticamente:

### 💻 Desktop
- Widget: 384px × 500px
- Posición: Fixed bottom-right
- Botón: Siempre visible

### 📱 Mobile
- Widget: Full width - 32px
- Altura: 500px
- Centrado horizontalmente
- Botón: Más grande para touch

---

## ✅ Checklist de Funcionamiento

Verifica que todo funcione:

- [ ] Botón 💬 visible en la esquina
- [ ] Click abre el widget
- [ ] Widget tiene header con "ARTEMA Bot v2"
- [ ] Puedes escribir mensajes
- [ ] Respuestas aparecen en tiempo real
- [ ] Imágenes de productos se cargan
- [ ] Click en ✕ cierra el widget
- [ ] Funciona en todas las páginas

---

## 🆘 Solución de Problemas

### No veo el botón 💬
1. Refresca la página (Ctrl + R)
2. Verifica que el servidor esté corriendo
3. Limpia caché (Ctrl + Shift + R)

### El botón no responde
1. Abre la consola del navegador (F12)
2. Busca errores en rojo
3. Verifica que JavaScript esté habilitado

### Las respuestas no llegan
1. Verifica tu conexión a internet
2. Revisa que la API esté funcionando
3. Consulta los logs del servidor

---

## 📚 Más Información

Para documentación completa, consulta:
- `CHATBOT_GLOBAL.md` - Guía detallada
- `src/components/ChatInterface.tsx` - Código fuente
- `src/app/api/chat/route.ts` - Lógica del backend

---

## 🎉 ¡Listo para Usar!

El chatbot está completamente funcional y listo para ayudar a tus usuarios.

**Próximos pasos sugeridos:**
1. Prueba diferentes consultas
2. Personaliza colores si lo deseas
3. Ajusta la posición según tu preferencia
4. ¡Disfruta de tu asistente virtual!

---

<div align="center">

**🤖 Chatbot Global Activo**

Disponible en todas las páginas • Integrado con OpenAI • Consulta productos en tiempo real

[Abrir sitio](http://localhost:3001) | [Ver documentación](CHATBOT_GLOBAL.md)

</div>

