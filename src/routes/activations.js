const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db');

// Helper to check if two date ranges overlap
function datesOverlap(startA, endA, startB, endB) {
  const sA = new Date(startA);
  const eA = new Date(endA);
  const sB = new Date(startB);
  const eB = new Date(endB);
  return sA <= eB && eA >= sB;
}

// GET all activations
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const activations = await db.getActivations();
    res.json(activations);
  } catch (err) {
    next(err);
  }
});

// GET single activation
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const act = await db.getActivationById(req.params.id);
    if (!act) {
      return res.status(404).json({ error: 'Activation not found' });
    }
    res.json(act);
  } catch (err) {
    next(err);
  }
});

// POST new activation
router.post('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      activityName,
      brandName,
      vendorName,
      category,
      activityType,
      objective,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      stores,
      images,
      authorId,
      authorEmail,
      authorName
    } = req.body;

    if (!activityName || !brandName || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields (activityName, brandName, startDate, endDate)' });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }

    const selectedStores = Array.isArray(stores) ? stores : [];
    if (selectedStores.length === 0) {
      return res.status(400).json({ error: 'At least one store must be selected' });
    }

    // Strict policy: Check conflict collision (Only 1 activity per store in overlapping dates)
    const existing = await db.getActivations();
    for (const act of existing) {
      if (datesOverlap(startDate, endDate, act.startDate, act.endDate)) {
        const conflictStore = selectedStores.find(st => act.stores && act.stores.includes(st));
        if (conflictStore) {
          return res.status(409).json({
            error: `Conflict: "${conflictStore}" is already booked for "${act.activityName}" (${act.brandName}) from ${act.startDate} to ${act.endDate}.`,
            conflict: {
              store: conflictStore,
              activityId: act.id,
              activityName: act.activityName
            }
          });
        }
      }
    }

    const created = await db.createActivation({
      activityName,
      brandName,
      vendorName,
      category,
      activityType,
      objective,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      stores: selectedStores,
      images: Array.isArray(images) ? images : [],
      authorId: authorId || 'local',
      authorEmail: (authorEmail || '').toLowerCase(),
      authorName: authorName || 'Staff Member'
    });

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT update activation
router.put('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const id = req.params.id;
    const existingAct = await db.getActivationById(id);
    if (!existingAct) {
      return res.status(404).json({ error: 'Activation not found' });
    }

    const {
      activityName,
      brandName,
      vendorName,
      category,
      activityType,
      objective,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      stores,
      images
    } = req.body;

    const sDate = startDate || existingAct.startDate;
    const eDate = endDate || existingAct.endDate;

    if (new Date(sDate) > new Date(eDate)) {
      return res.status(400).json({ error: 'Start date cannot be after end date' });
    }

    const targetStores = stores ? stores : existingAct.stores;

    // Check conflict against other activations
    const allActivations = await db.getActivations();
    for (const act of allActivations) {
      if (act.id === id) continue;
      if (datesOverlap(sDate, eDate, act.startDate, act.endDate)) {
        const conflictStore = targetStores.find(st => act.stores && act.stores.includes(st));
        if (conflictStore) {
          return res.status(409).json({
            error: `Conflict: "${conflictStore}" is already booked for "${act.activityName}" (${act.brandName}) from ${act.startDate} to ${act.endDate}.`,
            conflict: {
              store: conflictStore,
              activityId: act.id,
              activityName: act.activityName
            }
          });
        }
      }
    }

    const updated = await db.updateActivation(id, {
      activityName,
      brandName,
      vendorName,
      category,
      activityType,
      objective,
      description,
      startDate: sDate,
      endDate: eDate,
      startTime,
      endTime,
      stores: targetStores,
      images
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE single activation
router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const success = await db.deleteActivation(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Activation not found' });
    }
    res.json({ message: 'Activation deleted successfully', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// POST bulk delete
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Must provide an array of IDs to delete' });
    }
    const db = getDatabase();
    const count = await db.bulkDeleteActivations(ids);
    res.json({ message: `${count} activations deleted successfully`, deletedCount: count });
  } catch (err) {
    next(err);
  }
});

// POST wipe all activations
router.post('/wipe', async (req, res, next) => {
  try {
    const db = getDatabase();
    await db.wipeActivations();
    res.json({ message: 'All activations wiped successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
