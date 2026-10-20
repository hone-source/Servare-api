FROM denoland/deno

WORKDIR /app

# Dependencias
COPY deno.json deno.lock ./
RUN deno install --frozen

# El usuario de ejecución es dueño de src para que Compose Watch pueda sincronizar archivos
COPY --chown=user src ./src
RUN deno cache --frozen src/main.ts

USER user

ENV PORT=8000
EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--cached-only", "src/main.ts"]
