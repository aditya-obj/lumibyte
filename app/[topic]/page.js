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
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [user, setUser] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const router = useRouter();
  const topic = unwrappedParams.topic;

  // Effect to handle scroll event listener for the button
  useEffect(() => {
    const checkScrollTop = () => {
      if (!showScrollButton && window.pageYOffset > 150) {
        setShowScrollButton(true);
      } else if (showScrollButton && window.pageYOffset <= 150) {
        setShowScrollButton(false);
      }
    };

    window.addEventListener('scroll', checkScrollTop);
    return () => window.removeEventListener('scroll', checkScrollTop);
  }, [showScrollButton]);

  // Function to scroll smoothly to the top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

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
      {showScrollButton && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top-button animate-fade-in"
          aria-label="Scroll to top"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={2.5} 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
      )}
    </div>
  );
}
