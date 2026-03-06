import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Load all trips for a user.
 * @param {string} uid
 * @returns {Promise<Array<Object>>}
 */
export async function loadTrips(uid) {
  const tripsRef = collection(db, 'users', uid, 'trips');
  const snapshot = await getDocs(tripsRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Save (create or overwrite) a trip document.
 * @param {string} uid
 * @param {Object} trip - must include an `id` field used as the document ID
 * @returns {Promise<void>}
 */
export async function saveTrip(uid, trip) {
  const tripRef = doc(db, 'users', uid, 'trips', trip.id);
  await setDoc(tripRef, trip);
}

/**
 * Delete a trip document.
 * @param {string} uid
 * @param {string} tripId
 * @returns {Promise<void>}
 */
export async function deleteTrip(uid, tripId) {
  const tripRef = doc(db, 'users', uid, 'trips', tripId);
  await deleteDoc(tripRef);
}

/**
 * Migrate trips stored in localStorage (from the monolith) into Firestore,
 * then clear the localStorage key.
 *
 * localStorage key: 'flightscore_trips'
 * Expected format: JSON array of trip objects, each with an `id` property.
 *
 * @param {string} uid
 * @returns {Promise<{ migrated: number }>}
 */
export async function migrateLocalStorageTrips(uid) {
  const LS_KEY = 'flightscore_trips';
  const raw = localStorage.getItem(LS_KEY);

  if (!raw) {
    return { migrated: 0 };
  }

  let localTrips;
  try {
    localTrips = JSON.parse(raw);
  } catch {
    console.warn('[migrateLocalStorageTrips] Could not parse localStorage data — skipping migration.');
    return { migrated: 0 };
  }

  if (!Array.isArray(localTrips) || localTrips.length === 0) {
    return { migrated: 0 };
  }

  // Load existing Firestore trips so we don't overwrite them
  const existing = await loadTrips(uid);
  const existingIds = new Set(existing.map((t) => t.id));

  let migrated = 0;

  for (const trip of localTrips) {
    if (!trip || !trip.id) continue;

    // Skip trips that already exist in Firestore
    if (existingIds.has(trip.id)) continue;

    try {
      await saveTrip(uid, trip);
      migrated++;
    } catch (err) {
      console.error(`[migrateLocalStorageTrips] Failed to migrate trip ${trip.id}:`, err);
    }
  }

  // Clear localStorage after successful migration
  localStorage.removeItem(LS_KEY);

  console.log(`[migrateLocalStorageTrips] Migrated ${migrated} trip(s) to Firestore.`);
  return { migrated };
}
