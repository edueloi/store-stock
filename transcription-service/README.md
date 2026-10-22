# Transcrição local do WhatsApp

O áudio é baixado pelo Baileys e transcrito em português neste serviço, com
`faster-whisper` e o modelo multilíngue `small` em CPU/int8. A transcrição não usa
API paga. A resposta do assistente continua usando a IA configurada pela loja.

O processo escuta apenas em `127.0.0.1:3032`. O backend autentica cada pedido com
`BAILEYS_INTERNAL_TOKEN`. Os bytes ficam em memória, não são gravados em disco nem
incluídos no histórico: somente o texto transcrito e os metadados são registrados.

Limites: 10 MB e 5 minutos por áudio, uma inferência por vez e duas threads de CPU.
Áudios sem fala, inválidos ou indisponíveis geram um pedido para repetir/escrever.
Um atendimento já atribuído à equipe recebe a transcrição sem resposta automática.

## Instalação no servidor

Requer Python 3.9+ e suporte a `venv` (Ubuntu: `python3.12-venv`). Dependências e
modelo ficam fora do checkout, em `/var/www/store-boxsys-transcription`.

```bash
python3 -m venv /var/www/store-boxsys-transcription/venv
/var/www/store-boxsys-transcription/venv/bin/pip install -r transcription-service/requirements.txt
/var/www/store-boxsys-transcription/venv/bin/python -c "from faster_whisper.utils import download_model; download_model('small', output_dir='/var/www/store-boxsys-transcription/models/small')"
pm2 startOrRestart transcription-service/ecosystem.config.cjs --update-env
pm2 save
curl --fail http://127.0.0.1:3032/health
```

O modelo é baixado apenas na instalação. O serviço usa `local_files_only=True`,
sem download ou cobrança de provedor durante a transcrição.

Configurações opcionais: `WHATSAPP_TRANSCRIPTION_URL` no backend,
`WHATSAPP_TRANSCRIPTION_PYTHON`, `WHISPER_MODEL_PATH`, `WHISPER_CPU_THREADS` e
`TRANSCRIPTION_PORT` no serviço. Atualize backend e serviço Baileys juntos.

## Verificação

```bash
node node_modules/tsx/dist/cli.mjs --test scripts/verify-whatsapp-audio.ts
python3 scripts/verify-whatsapp-transcription.py
```

Defina `TRANSCRIPTION_SAMPLE` com um WAV de teste em português e
`WHISPER_MODEL_PATH` para verificar o reconhecimento real com o Python do venv.
