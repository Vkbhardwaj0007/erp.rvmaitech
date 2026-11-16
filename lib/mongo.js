'use strict';
/**
 * MongoDB Atlas Connection & Real-Time Sync Service for Business Suite
 * Connects to user's MongoDB database (rvmaitech) on MongoDB Atlas.
 */
const { MongoClient } = require('mongodb');

let client = null;
let mongoDb = null;
let isConnected = false;
let lastSyncTime = null;
let lastError = null;

const DEFAULT_URI = 'mongodb+srv://vkbhardwaj9580_db_user:yaO4TfQm37Z8KpFAtnNw1JXL@cluster0.pebt4f9.mongodb.net/rvmaitech?retryWrites=true&w=majority&appName=Cluster0';

async function connectMongo(customUri) {
  const uri = customUri || process.env.MONGO_URI || DEFAULT_URI;
  if (!uri) {
    console.log('[mongo] No MONGO_URI provided; skipping MongoDB connection.');
    return false;
  }

  try {
    if (client) {
      try { await client.close(); } catch (e) {}
    }

    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });

    await client.connect();
    // Default db from URI or 'rvmaitech'
    mongoDb = client.db('rvmaitech');
    isConnected = true;
    lastError = null;
    console.log('[mongo] Successfully connected to MongoDB Atlas database:', mongoDb.databaseName);

    // Ensure collections exist with indexes
    await mongoDb.collection('bs_employees').createIndex({ code: 1 }, { unique: false }).catch(() => {});
    await mongoDb.collection('bs_attendance').createIndex({ date: 1 }, { unique: false }).catch(() => {});

    return true;
  } catch (err) {
    isConnected = false;
    lastError = err.message;
    console.error('[mongo] Failed to connect to MongoDB Atlas:', err.message);
    return false;
  }
}

function getMongoStatus() {
  return {
    connected: isConnected,
    db: mongoDb ? mongoDb.databaseName : 'rvmaitech',
    lastSync: lastSyncTime,
    error: lastError
  };
}

/**
 * Sync entire Business Suite data snapshot & entities to MongoDB
 */
async function syncToMongo(dbData) {
  if (!isConnected || !mongoDb) return false;

  try {
    const now = new Date().toISOString();

    // 1. Sync Employees
    if (Array.isArray(dbData.employees)) {
      const empCol = mongoDb.collection('bs_employees');
      for (const emp of dbData.employees) {
        if (!emp || !emp.id) continue;
        await empCol.updateOne(
          { _id: emp.id },
          { $set: Object.assign({}, emp, { _syncedAt: now }) },
          { upsert: true }
        );
      }
    }

    // 2. Sync Attendance
    if (dbData.attendance && typeof dbData.attendance === 'object') {
      const attCol = mongoDb.collection('bs_attendance');
      for (const [date, dayMarks] of Object.entries(dbData.attendance)) {
        await attCol.updateOne(
          { _id: date },
          { $set: { date, marks: dayMarks, _syncedAt: now } },
          { upsert: true }
        );
      }
    }

    // 3. Sync Tasks & Projects
    if (Array.isArray(dbData.tasks)) {
      const taskCol = mongoDb.collection('bs_tasks');
      for (const task of dbData.tasks) {
        if (!task || !task.id) continue;
        await taskCol.updateOne(
          { _id: task.id },
          { $set: Object.assign({}, task, { _syncedAt: now }) },
          { upsert: true }
        );
      }
    }

    if (Array.isArray(dbData.projects)) {
      const projCol = mongoDb.collection('bs_projects');
      for (const proj of dbData.projects) {
        if (!proj || !proj.id) continue;
        await projCol.updateOne(
          { _id: proj.id },
          { $set: Object.assign({}, proj, { _syncedAt: now }) },
          { upsert: true }
        );
      }
    }

    // 4. Save metadata snapshot
    await mongoDb.collection('bs_snapshot').updateOne(
      { _id: 'current_system' },
      {
        $set: {
          updatedAt: now,
          company: dbData.company || {},
          stats: {
            employeesCount: (dbData.employees || []).length,
            tasksCount: (dbData.tasks || []).length,
            projectsCount: (dbData.projects || []).length,
            attendanceDaysCount: Object.keys(dbData.attendance || {}).length,
            usersCount: (dbData.users || []).length
          }
        }
      },
      { upsert: true }
    );

    lastSyncTime = now;
    lastError = null;
    return true;
  } catch (err) {
    lastError = err.message;
    console.error('[mongo] Sync failed:', err.message);
    return false;
  }
}

/**
 * Fetch all employees from MongoDB
 */
async function fetchEmployeesFromMongo() {
  if (!isConnected || !mongoDb) return [];
  try {
    return await mongoDb.collection('bs_employees').find({}).toArray();
  } catch (e) {
    return [];
  }
}

module.exports = {
  connectMongo,
  getMongoStatus,
  syncToMongo,
  fetchEmployeesFromMongo,
  isMongoConnected: () => isConnected
};
