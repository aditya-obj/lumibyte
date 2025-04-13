'use client'
import ActivityHeatmap from '@/components/ActivityHeatmap';
import { auth, db } from '@/components/firebase.config';
import { format } from 'date-fns';
import { get, ref } from 'firebase/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter
import { useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import Breadcrumbs from '@/components/Breadcrumbs';

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
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
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
      <Breadcrumbs />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user?.displayName}
        </h1>

        {/* Stats Summary - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && (
          // Adjusted grid columns to accommodate 5 items
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
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
          <div className="p-6 bg-gray-800/40 rounded-xl border border-gray-700"> {/* Adjusted background */}
            <h2 className="text-xl font-semibold text-white mb-4">Your Activity</h2>
            <ActivityHeatmap questions={questions} />
          </div>
        )}

        {/* Topic Filter Dropdown - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && view === 'all' && ( // Only show filter when 'all' view is active
          <div className="flex justify-start mb-6"> {/* Align left and add margin-bottom */}
            <div className="w-full max-w-xs"> {/* Keep max-width for reasonable size */}
              <label htmlFor="topic-filter" className="block text-sm font-medium text-gray-400 mb-1"> {/* Removed text-center */}
                Filter by Topic
              </label>
              <select
                id="topic-filter"
                name="topic-filter"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-700 bg-gray-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm rounded-md shadow-sm appearance-none transition-colors duration-200 cursor-pointer" // Added cursor-pointer
              >
                {uniqueTopics.map((topic) => (
                  <option key={topic} value={topic} className="bg-gray-700 text-white"> {/* Added background for options */}
                    {topic === 'all' ? 'All Topics' : topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* View Switch - Only show if not loading and there are questions */}
        {!loading && questions.length > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex bg-gray-900/60 border border-gray-700 p-1 rounded-lg shadow-sm">
              <button
                onClick={() => setView('all')}
                className={`px-5 py-2 rounded text-sm font-medium transition-all duration-300 ease-in-out cursor-pointer whitespace-nowrap ${
                  view === 'all' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700/50'
                }`}
              >
                All Programs
              </button>
              <button
                onClick={() => setView('revised')}
                className={`px-5 py-2 rounded text-sm font-medium transition-all duration-300 ease-in-out cursor-pointer whitespace-nowrap ${
                  view === 'revised' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700/50'
                }`}
              >
                Recently Revised
              </button>
            </div>
          </div>
        )}

        {/* Questions Section */}
        <div> {/* Added a wrapper div for the conditional rendering */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : questions.length === 0 ? (
             // Empty State Message
             <div className="text-center py-16 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
               <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                 <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
               </svg>
               <h3 className="mt-2 text-lg font-medium text-gray-300">No questions revised yet</h3>
               <p className="mt-1 text-sm text-gray-500">Start revising some questions to see them here.</p>
               {/* Optional: Add a button to navigate somewhere */}
               {/* <div className="mt-6">
                 <Link href="/questions" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                   Browse Questions
                 </Link>
               </div> */}
             </div>
          ) : (
            // Map over questions if not empty
            <div className="space-y-12"> {/* Moved space-y here */}
              {Object.entries(groupedQuestions).map(([topic, topicQuestions]) => (
                <div key={topic}>
                  <h2 className="text-3xl font-bold text-white mb-6 pb-3 border-b border-gray-700/50">
                    {topic}
                    <span className="text-base font-medium text-gray-400 ml-3">
                      ({topicQuestions.length} {topicQuestions.length === 1 ? 'item' : 'items'})
                    </span>
                  </h2>
                
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topicQuestions.map((question) => (
                      <div
                        key={question.id}
                        className="group rounded-lg bg-gradient-to-br from-gray-800/60 to-gray-900/70 border border-gray-700/80 shadow-lg transition-all duration-300 hover:shadow-blue-500/20 hover:border-blue-600/50 p-6 flex flex-col justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <Link href={`/${createSlug(question.topic)}/${createSlug(question.title)}`} className="flex-1 group-hover:text-blue-300 transition-colors">
                               <h3 className="text-lg font-semibold text-white leading-tight"> 
                                {question.title}
                              </h3>
                            </Link>
                            <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${getDifficultyStyles(question.difficulty)}`}>
                              {question.difficulty.toUpperCase()}
                            </div>
                          </div>
                        
                          {question.lastRevised ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Revised: {formatDate(question.lastRevised)}</span>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 italic mb-5">Not revised yet</div>
                          )}
                        </div>
                      
                        <div className="mt-auto"> 
                          <Link 
                            href={`/${createSlug(question.topic)}/${createSlug(question.title)}`}
                            className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 
                              bg-gray-800/80 hover:bg-gray-800/90
                              text-blue-300 rounded-md transition-all duration-300 
                              border border-blue-500/20
                              hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]
                              hover:-translate-y-0.5 group"
                          >
                            View Details
                            <svg 
                              className="w-4 h-4 transition-transform group-hover:translate-x-1" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M14 5l7 7m0 0l-7 7m7-7H3" 
                              />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div> // Closing div for the map result
          )} {/* Closing brace for the main conditional block */}
        </div> {/* Closing wrapper div for conditional rendering */}

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
              strokeWidth={2} 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
