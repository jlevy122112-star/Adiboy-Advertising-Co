import app from './app';
import { env } from './config/env';
import { logger } from './common/logger';
import { startScheduler } from './jobs/scheduler';

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${env.NODE_ENV}]`);
  startScheduler();
});
