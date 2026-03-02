

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');



router.get('/sync/pull', async (req, res) => {
  try {
    const userId = req.query.userId; 
    const db = mongoose.connection.db;
    
    let boards = [];
    let columns = [];
    let tasks = [];
    let activityLogs = [];

    if (userId) {
      // 1. Get only THIS user's boards
      boards = await db.collection('boards').find({ ownerId: userId }).toArray();
      const boardIds = boards.map(b => b._id); // Extract the IDs

      // 2. Get only columns belonging to THIS user's boards
      if (boardIds.length > 0) {
        columns = await db.collection('columns').find({ boardId: { $in: boardIds } }).toArray();
        const columnIds = columns.map(c => c._id);

        // 3. Get only tasks belonging to THIS user's columns
        if (columnIds.length > 0) {
          tasks = await db.collection('tasks').find({ columnId: { $in: columnIds } }).toArray();
        }
      }
      
      // (Optional) Get activity logs. If your logs don't have user IDs, you can skip filtering them or filter by entityId
      activityLogs = await db.collection('activity_logs').find({ownerId: userId}).sort({ createdAt: -1 }).limit(20).toArray();
    }

    res.status(200).json({ success: true, boards, columns, tasks, activityLogs });

  } catch (error) {
    console.error('Pull Error:', error);
    res.status(500).json({ error: 'Internal Server Error during pull' });
  }
});







// --- 2. THE UPGRADED PUSH ROUTE (WITH STRICT LWW CONFLICT RESOLUTION) ---
router.post('/sync', async (req, res) => {
  try {
    const { operations, userId } = req.body;
    if (!operations || operations.length === 0) {
      return res.status(200).json({ message: 'No operations to sync' });
    }

    const db = mongoose.connection.db;
    const bulkOps = { boards: [], columns: [], tasks: [], activity_logs: [] };
    const conflicts = []; // <--- NEW: Store server-winning conflicts

    for (const op of operations) {
      const { operationType, entityId, queueId, payload, createdAt } = op;
      const ownerId = userId; 

      // 1. Log the Activity
      bulkOps.activity_logs.push({
        // insertOne: {
        //   document: {
        //     _id: queueId, ownerId: ownerId, entityId: entityId,
        //     operationType: operationType, payload: payload,
        //     createdAt: new Date(createdAt)
        //   }
        // }

        updateOne: {
          filter: { _id: queueId }, // Look for existing log with this queueId
          update: { 
            $set: {
              ownerId: ownerId, 
              entityId: entityId,
              operationType: operationType, 
              payload: payload,
              createdAt: new Date(createdAt)
            }
          },
          upsert: true // Insert if it doesn't exist, update if it does!
        }
      });

      // 2. Collection Detection
      let collectionName = 'unknown';
      if (payload.color !== undefined) collectionName = 'boards';
      else if (payload.boardId !== undefined) collectionName = 'columns';
      else if (payload.columnId !== undefined || payload.priority !== undefined || payload.description !== undefined) collectionName = 'tasks';
      else {
        if (await db.collection('tasks').findOne({ _id: entityId })) collectionName = 'tasks';
        else if (await db.collection('columns').findOne({ _id: entityId })) collectionName = 'columns';
        else if (await db.collection('boards').findOne({ _id: entityId })) collectionName = 'boards';
      }

      if (collectionName === 'unknown') continue;

      // Normalize Client Dates
      if (payload.createdAt) payload.createdAt = new Date(payload.createdAt);
      if (payload.updatedAt) payload.updatedAt = new Date(payload.updatedAt);
      if (payload.dueDate && typeof payload.dueDate === 'number') payload.dueDate = new Date(payload.dueDate);

      // 3. STRICT LWW CONFLICT DETECTION
      if (operationType === 'UPDATE') {
        const existingDoc = await db.collection(collectionName).findOne({ _id: entityId });
        
        // If Server is newer than Client -> SERVER WINS
        if (existingDoc && existingDoc.updatedAt > payload.updatedAt) {
          console.log(`⚠️ Conflict Detected on ${entityId}. Server Wins.`);
          conflicts.push({
            queueId: queueId,
            entityType: collectionName,
            serverData: existingDoc // Return the server data as required by spec!
          });
          continue; // Skip adding to bulkOps, we reject the client's update
        }
        
        // If Client is newer or equal -> CLIENT WINS
        bulkOps[collectionName].push({
          updateOne: { filter: { _id: entityId }, update: { $set: payload }, upsert: true }
        });
      } 
      else if (operationType === 'INSERT') {
        bulkOps[collectionName].push({ insertOne: { document: { _id: entityId, ...payload } } });
      } 
      else if (operationType === 'DELETE') {
        bulkOps[collectionName].push({
          updateOne: { filter: { _id: entityId }, update: { $set: payload }, upsert: true }
        });
      }
    }

    // 4. Execute Operations
    const writePromises = Object.entries(bulkOps).map(([collection, ops]) => {
      if (ops.length > 0) return db.collection(collection).bulkWrite(ops, { ordered: false });
      return Promise.resolve();
    });

    await Promise.all(writePromises);
    
    // 5. Return conflicts to Flutter!
    res.status(200).json({ success: true, conflicts: conflicts });

  } catch (error) {
    console.error('Sync Error:', error);
    res.status(500).json({ error: 'Internal Server Error during sync' });
  }
});



module.exports = router;