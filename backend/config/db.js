const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student_early_alert';
  const isCloudAtlas = mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net');

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000
    });

    console.log(`====================================================`);
    console.log(`✅ [MongoDB Connected]: ${conn.connection.host}/${conn.connection.name}`);
    console.log(`🌐 Cluster Type: ${isCloudAtlas ? 'MongoDB Atlas Cloud' : 'Local MongoDB Instance'}`);
    console.log(`====================================================`);
  } catch (error) {
    console.error(`❌ [MongoDB Connection Error]: ${error.message}`);
    console.warn(`💡 Deployment Tip: If deploying to cloud (Render/Railway), ensure MONGODB_URI is set to your MongoDB Atlas cluster connection string and Network Access is set to allow 0.0.0.0/0.`);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB Warning]: Database disconnected. Attempting automatic reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 [MongoDB Success]: Database reconnected successfully.');
  });
};

module.exports = connectDB;
