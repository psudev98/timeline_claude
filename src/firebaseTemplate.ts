import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export function subscribeToMilestones(callback: (items: unknown[]) => void) {
  const milestonesQuery = query(collection(db, 'milestones'), orderBy('date', 'asc'));
  return onSnapshot(milestonesQuery, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
}

export async function uploadMilestonePhoto(file: File) {
  const photoRef = ref(storage, `photos/${crypto.randomUUID()}-${file.name}`);
  await uploadBytes(photoRef, file);
  return getDownloadURL(photoRef);
}

export async function addMilestoneToFirestore(data: Record<string, unknown>) {
  return addDoc(collection(db, 'milestones'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
