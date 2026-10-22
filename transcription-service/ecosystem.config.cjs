const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

module.exports = { apps: [{
  name: 'store-boxsys-transcription',
  cwd: __dirname,
  script: 'server.py',
  interpreter: process.env.WHATSAPP_TRANSCRIPTION_PYTHON || '/var/www/store-boxsys-transcription/venv/bin/python',
  env: {
    PYTHONUNBUFFERED: '1',
    BAILEYS_INTERNAL_TOKEN: process.env.BAILEYS_INTERNAL_TOKEN,
    WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH || '/var/www/store-boxsys-transcription/models/small',
    WHISPER_CPU_THREADS: process.env.WHISPER_CPU_THREADS || '2',
    TRANSCRIPTION_PORT: process.env.TRANSCRIPTION_PORT || '3032',
    OMP_NUM_THREADS: '2',
  },
  max_memory_restart: '1800M',
  kill_timeout: 30_000,
  restart_delay: 5_000,
}] };
