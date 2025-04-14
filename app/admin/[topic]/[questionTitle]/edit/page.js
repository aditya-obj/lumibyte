'use client';
import EditQuestion from '@/components/EditQuestion';
import { useSearchParams } from 'next/navigation';

export default function AdminEditQuestionPage() {
  const searchParams = useSearchParams();
  const questionId = searchParams.get('id');

  if (!questionId) return null;

  return <EditQuestion 
    questionId={questionId} 
    location="public/questions" 
  />;
}
