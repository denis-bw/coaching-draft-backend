import express from 'express';
import logger from 'morgan';
import cors from 'cors';

import {initializeFirebase} from './firebaseAdminConfig.js'; 
import authRouter from './routes/api/auth-router.js';
import profileRouter from './routes/api/user-profile-router.js'

const app = express();
const formatsLogger = app.get('env') === 'development' ? 'dev' : 'short';

const allowedOrigins = ['http://localhost:5173', 'https://denis-bw.github.io'];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);  
    } else {
      callback(new Error('Not allowed by CORS')); 
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Accept'], 
  preflightContinue: false,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(logger(formatsLogger));  
app.use(express.json());  
app.use(express.static('public'));  

const PORT = process.env.PORT || 3000;


async function startServer() {
  try {
    await initializeFirebase(); 
    console.log('DB connection successful.');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Error initializing Firebase:', error);
    process.exit(1); 
  }
}

startServer();

app.use('/api/auth', authRouter);
app.use('/api/auth', profileRouter);
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  const { status = 500, message = 'Server error' } = err;
  res.status(status).json({ message });
});


