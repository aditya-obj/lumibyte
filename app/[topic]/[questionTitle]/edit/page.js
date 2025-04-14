'use client';
import { auth } from '@/components/firebase.config';
import EditQuestion from '@/components/EditQuestion';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditQuestionPage() {
  const searchParams = useSearchParams();
  const questionId = searchParams.get('id');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!userId || !questionId) return null;

  return <EditQuestion 
    questionId={questionId} 
    location={`users/${userId}/questions`} 
  />;
}
