'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/components/firebase.config';
import { ref, get } from 'firebase/database';
import QuestionCard from '@/components/QuestionCard';
import { createSlug } from '@/utils/helpers';
import React from 'react';
import Loader from '@/components/Loader';

export default function TopicPage({ params }) {
  const unwrappedParams = React.use(params);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const topic = unwrappedParams.topic;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        if (user) {
          const userQuestionsRef = ref(db, `users/${user.uid}/questions`);
          const snapshot = await get(userQuestionsRef);
          
          if (snapshot.exists()) {
            const questionsData = [];
            snapshot.forEach((childSnapshot) => {
              const question = childSnapshot.val();
              if (createSlug(question.topic) === topic) {
                questionsData.push({
                  id: childSnapshot.key,
                  ...question
                });
              }
            });
            
            questionsData.sort((a, b) => {
              if (!a.lastRevised && !b.lastRevised) return 0;
              if (!a.lastRevised) return 1;
              if (!b.lastRevised) return -1;
              return b.lastRevised - a.lastRevised;
            });
            
            setQuestions(questionsData);
          }
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [user, topic]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white capitalize">
              {topic.replace(/-/g, ' ')}
            </h1>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>

          {questions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  topic={topic}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg">
                No questions found for this topic.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
