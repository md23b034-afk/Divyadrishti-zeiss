# Cloud Run (asia-south1, Mumbai: data stays in India)
FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server server
COPY web web
ENV DD_DB=/tmp/divyadrishti.db PORT=8080
CMD exec uvicorn server.app:app --host 0.0.0.0 --port ${PORT}
