const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./backend/config/db');
const { notFound, errorHandler } = require('./backend/middleware/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Static folder for Modern Web Frontend Dashboard
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./backend/routes/authRoutes'));
app.use('/api/admin', require('./backend/routes/adminRoutes'));
app.use('/api/teacher', require('./backend/routes/teacherRoutes'));
app.use('/api/students', require('./backend/routes/studentRoutes'));
app.use('/api/alerts', require('./backend/routes/alertRoutes'));
app.use('/api/interventions', require('./backend/routes/interventionRoutes'));
app.use('/api/analytics', require('./backend/routes/analyticsRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    project: 'Student Early Alert System (SEAS)',
    course: 'Full Stack Development 2 (FSD 2)',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Student Early Alert System (Backend) running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
    console.error(`💡 Solution: Stop the existing backend server in your other terminal, or run:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
