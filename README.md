# Lya

Lya es un agente de IA personal, estructurado, simple, ejecutable localmente y que utiliza Telegram y una interfaz web como interfaces.

## Características
- **Seguro y Privado:** Mediante validación de ID de usuario en Telegram.
- **Memoria Persistente:** Utiliza SQLite para almacenar el contexto y el historial de chat.
- **Agent Loop Dinámico:** El agente puede utilizar herramientas (como consultar una base de datos SQL) para responder a las solicitudes.
- **LLM Local:** Se conecta a un endpoint local de Ollama para todas las operaciones de IA, asegurando la privacidad.
- **Múltiples Habilidades:** Soporta diferentes "habilidades" (prompts) como `personal`, `codigo`, y `sistema` que se pueden cambiar con comandos.

## Requisitos
- Node.js (v18 o superior)
- Ollama instalado y ejecutando un modelo (ej. `llama3.1`).
- Un Bot de Telegram creado vía BotFather
- Tu User ID de Telegram (puedes averiguarlo usando bots como @userinfobot)
- Acceso a una base de datos SQL Server (para la habilidad `sistema`).

## Instalación

1. Abre el directorio del proyecto y ejecuta la instalación de dependencias de Node.js:
   ```bash
   npm install
   ```
2. Renombra `.env.example` a `.env` y rellena la información requerida. Un ejemplo mínimo:
   ```env
   TELEGRAM_BOT_TOKEN="Tu token de bot"
   TELEGRAM_ALLOWED_USER_IDS="123456789"
   DB_PATH="./memory.db"
   OLLAMA_MODEL="yasserrmd/Llama-4-Scout-17B-16E-Instruct:latest" # Modelo a usar por Ollama
   OLLAMA_TIMEOUT=300 # Timeout en segundos. Modelos grandes pueden necesitar más tiempo para cargar.
   
   # Credenciales para la habilidad 'sistema'
   SQL_USER="tu_usuario_sql"
   SQL_PASSWORD="tu_password_sql"
   SQL_SERVER="localhost"
   SQL_DATABASE="tu_base_de_datos"
   ```

## Uso

Para iniciarlo en modo desarrollo usando `tsx`:
```bash
npm run dev
```

## Scripts Adicionales

Para mantener la base de datos limpia y de un tamaño manejable, puedes ejecutar periódicamente el script de limpieza:
```bash
npm run cleanup
```
(Nota: El agente mostrará por consola cualquier intento de acceso no autorizado).
