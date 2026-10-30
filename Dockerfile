FROM denoland/deno

WORKDIR /app

# Dependencias
COPY deno.json deno.lock ./
RUN deno install --frozen

# Usuario sin privilegios para ejecutar la aplicación
RUN useradd --create-home usuario

# El usuario de ejecución es dueño de src para que Compose Watch pueda sincronizar archivos
COPY --chown=usuario src ./src
RUN deno cache --frozen src/main.ts

USER usuario

ENV PORT=8000
EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-sys", "--allow-read=/certs", "--cached-only", "src/main.ts"]
