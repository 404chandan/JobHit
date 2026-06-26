import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/environment';
import { logger } from './utils/logger';
import apiRouter from './routes/api';
import { initScheduler } from './services/scheduler';

const app = express();
const PORT = config.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static screenshots folder (for resolved form visuals)
app.use('/jobhit/screenshots', express.static(path.join(__dirname, '../screenshots')));

// Routes
app.use('/jobhit/api', apiRouter);

// Serve static React production bundle
const publicPath = path.join(__dirname, '../public');
app.use('/jobhit', express.static(publicPath));

// Redirect non-API routes under /jobhit to index.html for React router
app.get('/jobhit/*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Redirect root to /jobhit
app.get('/', (req, res) => {
  res.redirect('/jobhit');
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled server error', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`JobHit Server running on http://localhost:${PORT}`);
  
  // Initialize cron job scheduler
  initScheduler();
});
