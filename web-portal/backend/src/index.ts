import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);

// Serve static React production bundle
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Redirect non-API requests under / to the React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Web Portal Server running on http://localhost:${PORT}`);
});
