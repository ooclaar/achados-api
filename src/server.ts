import { ServicoDeAchados } from './aplicacao/servico-de-achados';
import { carregarConfig } from './config';
import { criarApp } from './http/app';
import { aplicarSchema, criarPool } from './infra/banco';
import { RepositorioPostgres } from './infra/repositorio-postgres';

// Composição: é aqui (e só aqui) que a implementação Postgres é escolhida.
async function iniciar(): Promise<void> {
  const config = carregarConfig();
  const pool = criarPool(config.databaseUrl);
  await aplicarSchema(pool);

  const app = criarApp({
    servico: new ServicoDeAchados(new RepositorioPostgres(pool)),
    verificarBanco: async () => {
      await pool.query('SELECT 1');
    },
    logger: { level: config.logLevel },
  });

  const encerrar = async (sinal: string) => {
    app.log.info({ sinal }, 'encerrando');
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void encerrar('SIGTERM'));
  process.on('SIGINT', () => void encerrar('SIGINT'));

  await app.listen({ host: '0.0.0.0', port: config.port });
}

iniciar().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
