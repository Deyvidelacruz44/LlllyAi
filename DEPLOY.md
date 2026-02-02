# 🚀 Guía de Despliegue a Producción

## Pre-requisitos

- [x] Node.js 18.x o superior
- [x] Cuenta en [Vercel](https://vercel.com) (gratis)
- [x] Proyecto Firebase configurado
- [x] API Key de Gemini

---

## 📋 Checklist Pre-Producción

### 1. Variables de Entorno
Asegúrate de tener configuradas todas las variables en Vercel:

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
GEMINI_API_KEY=...
```

### 2. Firebase Console
- [ ] **Authentication**: Habilitar Email/Password y Google Sign-In
- [ ] **Firestore**: Publicar reglas desde `firestore.rules`
- [ ] **Firestore**: Publicar índices desde `firestore.indexes.json`
- [ ] **Storage**: Publicar reglas desde `storage.rules`
- [ ] **Dominios autorizados**: Agregar tu dominio de Vercel

### 3. Publicar Reglas de Firebase

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto (si no lo has hecho)
firebase init

# Publicar reglas e índices
firebase deploy --only firestore:rules,firestore:indexes,storage
```

---

## 🌐 Despliegue en Vercel

### Opción A: Desde GitHub (Recomendado)

1. Sube tu código a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/agenda-ai-personal.git
   git push -u origin main
   ```

2. Ve a [vercel.com](https://vercel.com) y conecta tu repositorio

3. Configura las variables de entorno en Vercel

4. Haz clic en "Deploy"

### Opción B: Desde CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Desplegar
vercel

# Seguir las instrucciones y agregar variables de entorno
```

---

## 🔒 Configuración de Seguridad en Firebase

### Agregar Dominio Autorizado

1. Ve a Firebase Console > Authentication > Settings
2. En "Authorized domains", agrega:
   - `tu-proyecto.vercel.app`
   - `tu-dominio-personalizado.com` (si tienes)

### Verificar Reglas de Firestore

Las reglas en `firestore.rules` ya están configuradas para:
- ✅ Solo usuarios autenticados pueden acceder
- ✅ Cada usuario solo ve sus propios datos
- ✅ Validación de userId en escrituras

---

## 📊 Monitoreo Post-Despliegue

### Vercel
- Dashboard: Ver métricas de uso
- Logs: Monitorear errores en tiempo real
- Analytics: Activar Web Vitals

### Firebase
- Console > Analytics: Usuarios activos
- Console > Firestore > Usage: Lecturas/escrituras
- Console > Auth > Users: Usuarios registrados

---

## ⚠️ Troubleshooting

### Error: "Permission denied" en Firestore
→ Publica las reglas: `firebase deploy --only firestore:rules`

### Error: "API key not valid"
→ Verifica que `GEMINI_API_KEY` esté configurada en Vercel

### Error: "auth/unauthorized-domain"
→ Agrega el dominio de Vercel en Firebase > Auth > Settings

### PWA no se instala
→ Verifica que el manifest y service worker se sirvan correctamente

---

## 📱 Verificar PWA

1. Abre Chrome DevTools (F12)
2. Ve a Application > Manifest
3. Verifica que no haya errores
4. Ve a Application > Service Workers
5. Verifica que esté "activated and running"

---

## 🎉 ¡Listo!

Tu aplicación está en producción. Próximos pasos opcionales:
- Configurar dominio personalizado en Vercel
- Activar Vercel Analytics
- Configurar alertas de Firebase

