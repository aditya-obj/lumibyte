'use client';
import { auth } from '@/components/firebase.config';
import AddQuestion from '@/components/AddQuestion';
import { useEffect, useState } from 'react';

export default function UserAddQuestionPage() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!userId) return null;

  return <AddQuestion location={`users/${userId}`} />;
}
