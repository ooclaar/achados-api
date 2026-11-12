export interface Config {
  port: number;
  logLevel: string;
  databaseUrl: string;
}

/** Toda configuração vem do ambiente. Sem DATABASE_URL a aplicação se recusa a subir. */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Variável de ambiente DATABASE_URL não definida (veja .env.example)');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT inválida: ${env.PORT}`);
  }

  return { port, logLevel: env.LOG_LEVEL ?? 'info', databaseUrl };
}
