# 🎨 Guía de Personalización del Logo

## 📍 Ubicación del Código
**Archivo:** `src/components/Navbar.tsx`  
**Líneas:** 78-87

## 🔧 Opciones de Implementación

### Opción 1: Logo SVG (Recomendado)
**Ventajas:** Escalable, ligero, nítido en cualquier resolución

```tsx
<div className="relative w-10 h-10 flex-shrink-0">
  <Image 
    src="/logo.svg" 
    alt="ARTEMA Logo"
    width={40}
    height={40}
    className="object-contain drop-shadow-sm"
    priority
  />
</div>
```

**Pasos:**
1. Coloca tu logo SVG en `/public/logo.svg`
2. Asegúrate que tenga dimensiones cuadradas (ej: viewBox="0 0 100 100")
3. ¡Listo! El código ya está configurado

---

### Opción 2: Logo PNG/JPG
**Ventajas:** Fácil de usar, compatible con cualquier diseño

```tsx
<div className="relative w-10 h-10 flex-shrink-0">
  <Image 
    src="/logo.png"  // ← Cambia a .png o .jpg
    alt="ARTEMA Logo"
    width={40}
    height={40}
    className="object-contain drop-shadow-sm"
    priority
  />
</div>
```

**Pasos:**
1. Coloca tu logo en `/public/logo.png`
2. Dimensiones recomendadas: 160x160px o 320x320px
3. Actualiza `src="/logo.svg"` a `src="/logo.png"`

---

### Opción 3: Logo con Fondo
Si tu logo necesita fondo de color:

```tsx
<div className="relative w-10 h-10 flex-shrink-0 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg p-1.5">
  <Image 
    src="/logo-white.svg"  // Logo blanco para contrastar
    alt="ARTEMA Logo"
    width={40}
    height={40}
    className="object-contain"
    priority
  />
</div>
```

---

### Opción 4: Logo Circular
Para logos que se ven mejor en círculo:

```tsx
<div className="relative w-10 h-10 flex-shrink-0">
  <Image 
    src="/logo.png" 
    alt="ARTEMA Logo"
    width={40}
    height={40}
    className="object-contain drop-shadow-sm rounded-full"  // ← rounded-full
    priority
  />
</div>
```

---

### Opción 5: Logo más Grande (Destacado)
Si quieres un logo más prominente:

```tsx
<div className="relative w-12 h-12 flex-shrink-0">  {/* ← Cambia de w-10 h-10 a w-12 h-12 */}
  <Image 
    src="/logo.svg" 
    alt="ARTEMA Logo"
    width={48}  // ← Actualiza también width/height
    height={48}
    className="object-contain drop-shadow-md"  // ← Más sombra
    priority
  />
</div>
```

---

### Opción 6: Logo con Animación al Hover

```tsx
<div className="relative w-10 h-10 flex-shrink-0 transition-transform hover:scale-110 hover:rotate-3">
  <Image 
    src="/logo.svg" 
    alt="ARTEMA Logo"
    width={40}
    height={40}
    className="object-contain drop-shadow-sm"
    priority
  />
</div>
```

---

## 🎯 Ajustar Texto del Logo

Si quieres cambiar o quitar el texto "ARTEMA" y "Timbres Personalizados":

### Quitar completamente el texto:
```tsx
{/* Elimina esta sección completa: */}
<div className="hidden sm:flex flex-col">
  <span className="text-lg font-bold text-gray-900 tracking-tight leading-tight">ARTEMA</span>
  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium leading-tight">Timbres Personalizados</span>
</div>
```

### Solo nombre (sin subtítulo):
```tsx
<div className="hidden sm:block">
  <span className="text-lg font-bold text-gray-900 tracking-tight">ARTEMA</span>
</div>
```

### Cambiar fuente del nombre:
```tsx
<span className="text-xl font-black text-gray-900 tracking-tighter leading-tight">
  ARTEMA
</span>
```

---

## 📐 Dimensiones Recomendadas

| Uso | Dimensiones | Formato |
|-----|------------|---------|
| Logo principal | 160x160px | SVG (ideal) |
| Logo retina | 320x320px | PNG |
| Logo favicon | 32x32px | ICO/PNG |
| Logo alta calidad | Vector | SVG |

---

## 🎨 Ejemplos de Colores de Fondo

### Gradiente Moderno
```tsx
className="bg-gradient-to-br from-indigo-600 to-violet-600"
```

### Degradado Cálido
```tsx
className="bg-gradient-to-br from-orange-500 to-pink-600"
```

### Degradado Fresco
```tsx
className="bg-gradient-to-br from-cyan-500 to-blue-600"
```

### Color Sólido Elegante
```tsx
className="bg-gray-900"  // Negro
className="bg-indigo-600"  // Azul índigo
className="bg-emerald-600"  // Verde esmeralda
```

---

## ⚡ Optimización de Rendimiento

### Priorizar carga del logo
```tsx
priority  // Ya está incluido - carga inmediata
```

### Lazy loading (NO recomendado para logo)
```tsx
loading="lazy"  // NO usar en el logo principal
```

### Placeholder mientras carga
```tsx
placeholder="blur"
blurDataURL="data:image/svg+xml;base64,..." // Opcional
```

---

## 🔍 Checklist de Implementación

- [ ] Logo colocado en `/public/`
- [ ] Dimensiones apropiadas (cuadrado preferible)
- [ ] Formato optimizado (SVG > PNG > JPG)
- [ ] Fondo transparente (si aplica)
- [ ] Probado en diferentes tamaños de pantalla
- [ ] Alt text descriptivo actualizado
- [ ] Contraste adecuado con el fondo del navbar

---

## 🆘 Troubleshooting

### El logo no se muestra
1. Verifica que el archivo existe en `/public/`
2. Revisa que el nombre coincide exactamente (case-sensitive)
3. Limpia la caché del navegador (Ctrl+Shift+R)
4. Reinicia el servidor de desarrollo

### El logo se ve distorsionado
```tsx
className="object-contain"  // Mantiene proporciones
// vs
className="object-cover"    // Llena el espacio (puede distorsionar)
```

### El logo es muy grande/pequeño
Ajusta `w-10 h-10` en el div contenedor:
- Pequeño: `w-8 h-8`
- Normal: `w-10 h-10` ✓ (actual)
- Grande: `w-12 h-12`
- Muy grande: `w-16 h-16`

---

## 💡 Tips Profesionales

1. **Usa SVG siempre que sea posible** - mejor calidad, menor peso
2. **Mantén el logo cuadrado** - más fácil de escalar y posicionar
3. **Prueba en modo oscuro/claro** - asegúrate que se vea bien en ambos
4. **Optimiza el tamaño del archivo** - usa herramientas como SVGO o TinyPNG
5. **Considera múltiples versiones** - logo completo, ícono solo, versión horizontal

---

**¿Necesitas ayuda?** Consulta la documentación de Next.js Image:
https://nextjs.org/docs/app/api-reference/components/image

