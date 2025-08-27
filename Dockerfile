FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    curl \
    make \
    openssl \
    sed \
    tcl \
    unzip \
    git \
    build-essential \
    python3 \
    nodejs \
    npm \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g yarn

RUN git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk
WORKDIR /opt/emsdk
RUN ./emsdk install latest && \
    ./emsdk activate latest

ENV PATH="/opt/emsdk:/opt/emsdk/upstream/emscripten:${PATH}"
ENV EMSDK="/opt/emsdk"
ENV EM_CONFIG="/opt/emsdk/.emscripten"

WORKDIR /build

CMD ["/bin/bash", "-c", "source /opt/emsdk/emsdk_env.sh && emcc --version && yarn install && make"]
