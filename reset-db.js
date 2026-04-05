import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: './server/.env' });

async function resetDatabase() {
  try {
    // Connect without specifying database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('🔌 Connected to MySQL');

    // Drop and recreate database
    await connection.query('DROP DATABASE IF EXISTS attendance_fines');
    console.log('🗑️  Dropped existing database');

    await connection.query('CREATE DATABASE attendance_fines');
    console.log('✅ Created fresh database: attendance_fines');

    await connection.end();
    console.log('\n✨ Database reset complete!');
    console.log('📝 Run "npm start" to create tables automatically\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetDatabase();
