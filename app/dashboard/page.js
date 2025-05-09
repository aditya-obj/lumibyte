'use client';
import Loader from '@/components/Loader';
import ActivityHeatmap from '@/components/ActivityHeatmap';
import QuestionCard from '@/components/QuestionCard';
import { auth, db } from '@/components/firebase.config';
import { get, ref } from 'firebase/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function Dashboard() {
  const [showScrollButton, setShowScrollButton] = useState(false); // State for scroll button visibility
  const [view, setView] = useState('all'); // 'all' or 'revised'
  const [selectedTopic, setSelectedTopic] = useState('all'); // State for topic filter
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true); // For question data loading
  const [user, authLoading, authError] = useAuthState(auth); // Get auth loading state
  const router = useRouter(); // Initialize router

  // Redirect to update profile if display name is missing after auth loads
  useEffect(() => {
    if (!authLoading && user && !user.displayName) {
      console.log("User found but displayName is missing, replacing current history entry with /update-profile.");
      // Use replace to prevent adding the dashboard (without name) state to history
      router.replace('/update-profile'); 
    }
  }, [user, authLoading, router]);

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

  const createSlug = (text) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    try {
      return format(timestamp, 'MMM d, yyyy h:mm a');
    } catch (e) {
      console.error("Date formatting error:", e);
      return 'Invalid date';
    }
  };

  const getDifficultyStyles = (difficulty) => {
    const level = difficulty.toLowerCase();
    // Adjusted opacity and colors for a slightly softer look
    if (level === 'easy') return 'bg-green-500/15 text-green-300 border border-green-500/25';
    if (level === 'medium') return 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/25';
    return 'bg-red-500/15 text-red-300 border border-red-500/25';
  };

  useEffect(() => {
    if (user) {
      const questionsRef = ref(db, `users/${user.uid}/questions`);
      get(questionsRef).then((snapshot) => {
        if (snapshot.exists()) {
          const questionsData = [];
          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            questionsData.push({
              id: childSnapshot.key,
              ...question
            });
          });
          setQuestions(questionsData);
        }
        setLoading(false);
      });
    } else {
      // If no user, stop loading
      setLoading(false);
    }
  }, [user]);

  // Extract unique topics for the filter dropdown
  const uniqueTopics = useMemo(() => {
    const topics = new Set(questions.map(q => q.topic || 'Uncategorized'));
    return ['all', ...Array.from(topics).sort()]; // Add 'all' option and sort
  }, [questions]);

  const groupedQuestions = useMemo(() => {
    // Filter questions based on selected topic first
    const filteredQuestions = questions.filter(question =>
      selectedTopic === 'all' || (question.topic || 'Uncategorized') === selectedTopic
    );

    if (view === 'revised') {
      // Apply revised filter *after* topic filter
      return {
        'Recently Revised': filteredQuestions
          .filter(q => q.lastRevised)
          .sort((a, b) => b.lastRevised - a.lastRevised)
      };
    }

    // Group the filtered questions by topic
    return filteredQuestions.reduce((acc, question) => {
      const topic = question.topic || 'Uncategorized';
      if (!acc[topic]) {
        acc[topic] = [];
      }
      acc[topic].push(question);
      return acc;
    }, {});
  }, [questions, view, selectedTopic]); // Add selectedTopic to dependencies

  // Calculate stats based on the original full list of questions, not filtered ones
  const stats = useMemo(() => {
    const total = questions.length;
    const revised = questions.filter(q => q.lastRevised).length; // Count only revised questions
    const easy = questions.filter(q => q.difficulty.toLowerCase() === 'easy').length;
    const medium = questions.filter(q => q.difficulty.toLowerCase() === 'medium').length;
    const hard = questions.filter(q => q.difficulty.toLowerCase() === 'hard').length;
    return { total, revised, easy, medium, hard }; // Include revised count
  }, [questions]);

  // Show loading spinner while auth state is resolving or if user needs redirect
  if (authLoading || (user && !user.displayName)) {
    return <Loader />;
  }

  // If no user after loading, maybe show a message or redirect to login
  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center">
        <p className="text-lg text-gray-400 mb-4">Please log in to view your dashboard.</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  // Render dashboard content only if user exists and has displayName
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user?.displayName}
        </h1>

        {/* Stats Summary - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && (
          // Adjusted grid columns to accommodate 5 items
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
            {/* New Total Questions Box */}
            <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700 text-center">
              <div className="text-3xl font-bold text-purple-400">{stats.total}</div>
              <div className="text-sm text-gray-400 mt-1">Total Questions</div>
            </div>
            {/* Corrected Total Revised Box */}
            <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.revised}</div>
              <div className="text-sm text-gray-400 mt-1">Total Revised</div>
            </div>
            <div className="bg-green-900/20 p-4 rounded-lg border border-green-700/50 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.easy}</div>
              <div className="text-sm text-gray-400 mt-1">Easy</div>
            </div>
            <div className="bg-yellow-900/20 p-4 rounded-lg border border-yellow-700/50 text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.medium}</div>
              <div className="text-sm text-gray-400 mt-1">Medium</div>
            </div>
            <div className="bg-red-900/20 p-4 rounded-lg border border-red-700/50 text-center">
              <div className="text-3xl font-bold text-red-400">{stats.hard}</div>
              <div className="text-sm text-gray-400 mt-1">Hard</div>
            </div>
          </div>
        )}

        {/* Activity Heatmap - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && (
          <div className="mt-8 p-6 bg-gray-800/40 rounded-xl border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Your Activity</h2>
            <ActivityHeatmap questions={questions} />
          </div>
        )}

        {/* Improved Topic Filter */}
        {!loading && questions.length > 0 && view === 'all' && (
          <div className="my-8 bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">Filter by Topic</label>
            <div className="flex flex-wrap gap-2">
              {uniqueTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                    ${selectedTopic === topic
                      ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                      : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                    }
                  `}
                >
                  {topic === 'all' ? 'All Topics' : topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* View Switch - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && (
          <div className="mt-8 flex justify-center">
            <div className="inline-flex bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 p-1.5 rounded-2xl shadow-lg">
              <button
                onClick={() => setView('all')}
                className={`
                  px-6 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-300 ease-in-out
                  ${view === 'all'
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70'
                  }
                `}
              >
                All Programs
              </button>
              <button
                onClick={() => setView('revised')}
                className={`
                  px-6 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-300 ease-in-out
                  ${view === 'revised'
                    ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/70'
                  }
                `}
              >
                Recently Revised
              </button>
            </div>
          </div>
        )}

        {/* Questions Section */}
        <div>
          {loading ? (
            <Loader />
          ) : questions.length === 0 ? (
            <div className="mt-4 text-center py-16 bg-gray-800/30 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center gap-4">
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">
                  <svg 
                    className="w-8 h-8 text-purple-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                
                {/* Text Content */}
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-purple-300">
                    No Questions Yet
                  </h3>
                  <p className="text-gray-400 max-w-sm mx-auto">
                    Start your learning journey by adding some questions to your collection.
                  </p>
                </div>

                {/* Action Button */}
                <Link 
                  href="/"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300 
                    rounded-xl transition-all duration-300 hover:bg-purple-500/30 
                    ring-1 ring-purple-500/30 hover:ring-purple-500/50
                    hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:-translate-y-0.5"
                >
                  <svg 
                    className="w-5 h-5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Browse Questions
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(groupedQuestions).map(([topic, topicQuestions]) => (
                <div key={topic}>
                  <h2 className="text-2xl font-semibold text-purple-400 mb-6">{topic}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topicQuestions.map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        user={user}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
    </div>
  );
}
