FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY run.py ./
COPY --from=frontend /build/dist ./frontend/dist
ENV ARUS_HOST=0.0.0.0 PORT=8765
RUN useradd --create-home arus && mkdir -p /app/data && chown -R arus:arus /app
USER arus
EXPOSE 8765
CMD ["python", "run.py"]
