FROM python:3.14-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
# torch bundles its own (older) libstdc++ and shadows the system one at import time,
# which breaks other compiled extensions loaded afterwards (e.g. pysimstring, pulled in
# transitively by medspacy) with "undefined symbol: _ZTVN10__cxxabiv117__class_type_infoE".
# Force the system libstdc++ to load first.
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libstdc++.so.6
EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
