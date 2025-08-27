#!/bin/bash
docker run -it --rm \
    -v "$(pwd)":/build \
    -w /build \
    wa-sqlite-mc-builder \
    bash -c "source /opt/emsdk/emsdk_env.sh && bash"
