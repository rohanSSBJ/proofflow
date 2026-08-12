import { createApp } from './app.js';
import { prisma } from './platform/db.js';

const { app, port } = createApp();

app.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({
    level: 'info',
    service: 'proofflow-api',
    message: 'API listening',
    host: '127.0.0.1',
    port
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', service: 'proofflow-api', message: 'Shutting down', signal }));
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
