# LyaGravity

LyaGravity es un agente de IA personal, estructurado, simple, ejecutable localmente y que utiliza Telegram como única interfaz.

## Características
- **Seguro y Privado:** Mediante validación de ID de usuario en Telegram.
- **Memoria Persistente:** Utiliza SQLite para almacenar el contexto y el historial de chat.
- **Agent Loop Dinámico:** El agente evalúa su propio progreso y utiliza la herramienta `get_current_time` cuando es necesario.
- **Fallback Activo:** Intenta utilizar Groq como LLM rápido y gratuito, y recurre a OpenRouter si falla.

## Requisitos
- Node.js (v18 o superior)
- Claves de APIs de Groq (y OpenRouter, si se desea respaldo)
- Un Bot de Telegram creado vía BotFather
- Tu User ID de Telegram (puedes averiguarlo usando bots como @userinfobot)

## Instalación

1. Abre el directorio del proyecto y ejecuta la instalación de dependencias de Node.js:
   ```bash
   npm install
   ```
2. Renombra `.env.example` a `.env` (o crea un archivo nuevo llamado `.env`) y rellena la información requerida:
   ```env
   TELEGRAM_BOT_TOKEN="Tu token de bot"
   TELEGRAM_ALLOWED_USER_IDS="123456789"
   GROQ_API_KEY="Tu key de groq"
   OPENROUTER_API_KEY="Tu key de openrouter"
   OPENROUTER_MODEL="openrouter/free"
   DB_PATH="./memory.db"
   ```

## Uso

Para iniciarlo en modo desarrollo usando `tsx`:
```bash
npm run dev
```

(Nota: El agente mostrará por consola cualquier intento de acceso no autorizado y utilizará `memory.db` en la carpeta raíz del proyecto para recordar tus conversaciones).
