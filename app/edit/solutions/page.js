'use client';
import { auth, db } from '@/components/firebase.config';
import { get, ref } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditSolutions() {
  const [showScrollButton, setShowScrollButton] = useState(false); // State for scroll button visibility
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchQuestions = async () => {
        setIsLoading(true);
        try {
          const questionsRef = ref(db, `users/${user.uid}/questions`);
          const snapshot = await get(questionsRef);
          
          if (snapshot.exists()) {
            const questionsData = [];
            snapshot.forEach((childSnapshot) => {
              const question = childSnapshot.val();
              // Only include questions that need solutions
              if (!question.solutions || !question.empty_code) {
                questionsData.push({
                  id: childSnapshot.key,
                  title: question.title,
                  topic: question.topic,
                  difficulty: question.difficulty,
                  hasSolutions: !!question.solutions,
                  hasEmptyCode: !!question.empty_code
                });
              }
            });
            setQuestions(questionsData);
          }
        } catch (error) {
          console.error('Error fetching questions:', error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchQuestions();
    }
  }, [user]);

  // Effect to handle scroll event listener for the button
  useEffect(() => {
    const checkScrollTop = () => {
      // Show button if scrolled down more than 150px
      if (!showScrollButton && window.pageYOffset > 150) {
        setShowScrollButton(true);
      // Hide button if scrolled back up to 150px or less
      } else if (showScrollButton && window.pageYOffset <= 150) {
        setShowScrollButton(false);
      }
    };

    window.addEventListener('scroll', checkScrollTop);
    return () => window.removeEventListener('scroll', checkScrollTop); // Cleanup listener
  }, [showScrollButton]);

  // Function to scroll smoothly to the top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const getDifficultyStyles = (difficulty) => {
    const level = difficulty?.toLowerCase() || '';
    if (level === 'easy') return 'bg-green-500/20 text-green-400 border border-green-400/30';
    if (level === 'medium') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30';
    return 'bg-red-500/20 text-red-400 border border-red-400/30';
  };

  const handleQuestionClick = (questionId) => {
    router.push(`/edit/solution/${questionId}`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-[#111827]">
      {/* Header with Back Button */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700/50 cursor-pointer"
            aria-label="Go back"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Questions Needing Solutions
            </h1>
            <p className="text-gray-400 mt-2">
              {questions.length} {questions.length === 1 ? 'question needs' : 'questions need'} solutions or starter code
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full"></div>
        </div>
      )}

      {/* Questions List */}
      {!isLoading && questions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">
            All questions have solutions and starter code! 🎉
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {questions.map((question) => (
          <div
            key={question.id}
            onClick={() => handleQuestionClick(question.id)}
            className="p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white group-hover:text-purple-400 transition-colors">
                  {question.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  {question.topic && (
                    <span className="px-3 py-1 rounded-full text-sm bg-gray-700/50 text-gray-300 border border-gray-600/50">
                      {question.topic}
                    </span>
                  )}
                  {question.difficulty && (
                    <span className={`px-3 py-1 rounded-full text-sm ${getDifficultyStyles(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  )}
                </div>
              </div>

              {/* Missing Items Indicators */}
              <div className="flex gap-2">
                {!question.hasEmptyCode && (
                  <span className="px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400 border border-blue-400/30">
                    Needs Starter Code
                  </span>
                )}
                {!question.hasSolutions && (
                  <span className="px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-400 border border-purple-400/30">
                    Needs Solutions
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scroll to Top Button */}
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
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="17 11 12 6 7 11" />
            <polyline points="17 18 12 13 7 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
