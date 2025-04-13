'use client';
import Login from '@/components/Login';
import { auth, db } from '@/components/firebase.config';
import { format } from 'date-fns';
import { get, push, ref, update } from 'firebase/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BeatLoader } from 'react-spinners';
import { toast } from 'react-toastify';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [hasImported, setHasImported] = useState(false);
  const [needsSolutions, setNeedsSolutions] = useState(false);
  const [hasNewQuestionsToImport, setHasNewQuestionsToImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(true);
  const router = useRouter();

  const handleAuthRequired = () => {
    setShowLogin(true);
  };

  useEffect(() => {
    setIsMounted(true);
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch questions and topics in parallel
        const questionsRef = ref(db, `users/${user.uid}/questions`);
        const snapshot = await get(questionsRef);
        
        if (snapshot.exists()) {
          const questionsData = [];
          let needsSolutionsFlag = false;

          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            
            if (!question.solutions || !question.empty_code) {
              needsSolutionsFlag = true;
            }

            questionsData.push({
              id: childSnapshot.key,
              title: question.title,
              topic: question.topic,
              difficulty: question.difficulty,
              lastRevised: question.lastRevised || null,
              hasSolutions: !!question.solutions,
              hasEmptyCode: !!question.empty_code
            });
          });

          setNeedsSolutions(needsSolutionsFlag);
          setQuestions(questionsData);

          // Extract unique topics
          const uniqueTopicsFromQuestions = [...new Set(questionsData.map(q => q.topic || 'Uncategorized'))].sort();
          setTopics(uniqueTopicsFromQuestions);
        } else {
          setQuestions([]);
          setTopics([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load questions');
      } finally {
        setIsLoading(false);
        setInitialLoadComplete(true);
      }
    };

    fetchData();
  }, [user]);

  // Separate useEffect for checking new questions to import
  useEffect(() => {
    const checkForNewQuestions = async () => {
      if (!user) return;

      try {
        const publicQuestionsRef = ref(db, 'public/questions');
        const publicQuestionsSnapshot = await get(publicQuestionsRef);
        
        const userQuestionsRef = ref(db, `users/${user.uid}/questions`);
        const userQuestionsSnapshot = await get(userQuestionsRef);

        if (!publicQuestionsSnapshot.exists()) {
          setHasNewQuestionsToImport(false);
          return;
        }

        const publicQuestions = Object.values(publicQuestionsSnapshot.val());
        const userQuestions = userQuestionsSnapshot.exists() 
          ? Object.values(userQuestionsSnapshot.val()) 
          : [];

        const hasNewQuestions = publicQuestions.some(publicQuestion => 
          !userQuestions.some(userQuestion => 
            userQuestion.title.toLowerCase() === publicQuestion.title.toLowerCase()
          )
        );

        setHasNewQuestionsToImport(hasNewQuestions);
      } catch (error) {
        console.error('Error checking for new questions:', error);
      }
    };

    checkForNewQuestions();
  }, [user]);

  const createSlug = (text) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleRandomize = () => {
    if (!user) {
      handleAuthRequired();
      return;
    }
    setIsRandomizing(true);
    
    setTimeout(() => {
      const filteredQuestions = selectedTopics.length > 0
        ? questions.filter(q => selectedTopics.includes(q.topic))
        : questions;
      
      if (filteredQuestions.length > 0) {
        // Sort questions by lastRevised timestamp
        const sortedQuestions = [...filteredQuestions].sort((a, b) => {
          if (!a.lastRevised) return -1;
          if (!b.lastRevised) return 1;
          return a.lastRevised - b.lastRevised;
        });

        // Get the questions with the same oldest timestamp
        const oldestTimestamp = sortedQuestions[0].lastRevised;
        const oldestQuestions = sortedQuestions.filter(q => 
          (!oldestTimestamp && !q.lastRevised) ||
          q.lastRevised === oldestTimestamp
        );

        // Randomly select from the oldest questions
        const randomIndex = Math.floor(Math.random() * oldestQuestions.length);
        setCurrentQuestion(oldestQuestions[randomIndex]);
      } else {
        setCurrentQuestion(null);
      }
      
      // Make sure to reset the randomizing state
      setIsRandomizing(false);
    }, 500); // Keep a small delay for the loading animation
  };

  const handleTopicSelect = (topic) => {
    if (!user) {
      handleAuthRequired();
      return;
    }
    if (!selectedTopics.includes(topic)) {
      setSelectedTopics([...selectedTopics, topic]);
    }
    setShowTopicDropdown(false);
  };

  const handleRemoveTopic = (topicToRemove) => {
    setSelectedTopics(selectedTopics.filter(topic => topic !== topicToRemove));
  };

  const handleClearTopics = () => {
    setSelectedTopics([]);
  };

  const getDifficultyStyles = (difficulty) => {
    const level = difficulty.toLowerCase();
    if (level === 'easy') return 'bg-green-500/20 text-green-400 border border-green-400/30';
    if (level === 'medium') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/30';
    return 'bg-red-500/20 text-red-400 border border-red-400/30';
  };

  const formatDate = (timestamp) => {
    if (!isMounted) return ''; // Return empty during server render
    if (!timestamp) return '';
    try {
      return format(timestamp, 'MMM d, yyyy h:mm a');
    } catch (e) {
      console.error("Date formatting error:", e);
      return 'Invalid date';
    }
  };

  const handleImportQuestions = async () => {
    if (!user) {
      handleAuthRequired();
      return;
    }

    setIsImporting(true);
    try {
      // Get public questions and topics in parallel
      const [publicQuestionsSnapshot, publicTopicsSnapshot] = await Promise.all([
        get(ref(db, 'public/questions')),
        get(ref(db, 'public/topics'))
      ]);
      
      if (!publicQuestionsSnapshot.exists()) {
        toast.error('No public questions available to import');
        return;
      }

      // Get user's existing questions and topics in parallel
      const [userQuestionsSnapshot, userTopicsSnapshot] = await Promise.all([
        get(ref(db, `users/${user.uid}/questions`)),
        get(ref(db, `users/${user.uid}/topics`))
      ]);

      const existingQuestions = userQuestionsSnapshot.exists() 
        ? Object.values(userQuestionsSnapshot.val()) 
        : [];

      // Import questions
      const publicQuestions = Object.values(publicQuestionsSnapshot.val());
      const newQuestions = publicQuestions.filter(publicQuestion => 
        !existingQuestions.some(eq => 
          eq.title.toLowerCase() === publicQuestion.title.toLowerCase()
        )
      );

      // Batch write questions
      if (newQuestions.length > 0) {
        const userQuestionsRef = ref(db, `users/${user.uid}/questions`);
        const updates = {};
        newQuestions.forEach((question) => {
          const newQuestionKey = push(userQuestionsRef).key;
          updates[`users/${user.uid}/questions/${newQuestionKey}`] = {
            ...question,
            importedAt: Date.now()
          };
        });
        
        await update(ref(db), updates);

        // Fetch updated questions immediately after import
        const updatedSnapshot = await get(ref(db, `users/${user.uid}/questions`));
        if (updatedSnapshot.exists()) {
          const updatedQuestionsData = [];
          updatedSnapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            updatedQuestionsData.push({
              id: childSnapshot.key,
              title: question.title,
              topic: question.topic,
              difficulty: question.difficulty,
              lastRevised: question.lastRevised || null,
              hasSolutions: !!question.solutions,
              hasEmptyCode: !!question.empty_code
            });
          });
          
          // Update questions state with new data
          setQuestions(updatedQuestionsData);
          
          // Extract and update topics
          const uniqueTopicsFromQuestions = [...new Set(updatedQuestionsData.map(q => q.topic || 'Uncategorized'))].sort();
          setTopics(uniqueTopicsFromQuestions);
        }
      }

      toast.success('Questions imported successfully!', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      
      setHasNewQuestionsToImport(false);

    } catch (error) {
      console.error('Error importing questions:', error);
      toast.error('Failed to import questions. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    const checkForNewQuestions = async () => {
      if (!user) return;

      try {
        // Get public questions
        const publicQuestionsRef = ref(db, 'public/questions');
        const publicQuestionsSnapshot = await get(publicQuestionsRef);
        
        // Get user's questions
        const userQuestionsRef = ref(db, `users/${user.uid}/questions`);
        const userQuestionsSnapshot = await get(userQuestionsRef);

        if (!publicQuestionsSnapshot.exists()) {
          setHasNewQuestionsToImport(false);
          return;
        }

        const publicQuestions = Object.values(publicQuestionsSnapshot.val());
        const userQuestions = userQuestionsSnapshot.exists() 
          ? Object.values(userQuestionsSnapshot.val()) 
          : [];

        // Check if there are any questions that haven't been imported
        const hasNewQuestions = publicQuestions.some(publicQuestion => 
          !userQuestions.some(userQuestion => 
            userQuestion.title.toLowerCase() === publicQuestion.title.toLowerCase()
          )
        );

        setHasNewQuestionsToImport(hasNewQuestions);
      } catch (error) {
        console.error('Error checking for new questions:', error);
      }
    };

    checkForNewQuestions();
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Breadcrumbs />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Remove the Lumibyte title section */}
          
          {/* Remove the Login/Logout Button section */}
        </div>

        {showLogin && <Login onClose={() => setShowLogin(false)} />}

        <div className="space-y-6">
          {/* Action Buttons with improved layout */}
          <div className="flex flex-col sm:flex-row gap-4">
            {!user ? (
              <button 
                onClick={handleAuthRequired}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:-translate-y-1 group"
              >
                <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Questions
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Dashboard Button */}
                <Link 
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:-translate-y-1 group"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Dashboard
                </Link>

                <Link 
                  href="/questions"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:-translate-y-1 group"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Questions
                </Link>

                {/* Admin Buttons - Only visible to admin */}
                {user.uid === process.env.NEXT_PUBLIC_USER_UID && (
                  <Link 
                    href="/admin"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:-translate-y-1 group"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Admin
                  </Link>
                )}

                {/* Show Import Questions OR Add Solutions button */}
                {hasNewQuestionsToImport && (
                  <button 
                    onClick={handleImportQuestions}
                    disabled={isImporting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:-translate-y-1 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Import New Questions</span>
                      </>
                    )}
                  </button>
                )}

                {needsSolutions && (
                  <Link 
                    href="/edit/solutions"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:-translate-y-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Add Solutions
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Success Notification */}
          {showSuccessNotification && (
            <div className="success-notification">
              <div className="success-content">
                <svg className="success-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span className="success-message">Questions imported successfully!</span>
              </div>
            </div>
          )}

          {/* Topic filtering section with improved UI */}
          <div className="relative z-20 space-y-4 bg-gray-800/30 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50"> {/* Added relative z-20 */}
            <h2 className="text-lg font-medium text-white/90 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Filter by Topics
            </h2>
            
            {/* Selected Topic Tags */}
            <div className="flex flex-wrap gap-2">
              {selectedTopics.length > 0 ? (
                <>
                  {selectedTopics.map((topic) => (
                    <div 
                      key={topic}
                      className="bg-gray-800 text-white text-sm px-2.5 py-1 rounded-lg flex items-center group transition-colors border border-gray-700" /* Removed hover background */
                    >
                      {topic}
                      <button
                        onClick={() => handleRemoveTopic(topic)}
                        className="text-gray-400 hover:text-red-400 transition-colors cursor-pointer ml-1" /* Adjusted margin */
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleClearTopics}
                    className="px-2.5 py-1 bg-gray-800/70 text-gray-400 hover:text-red-400 rounded-lg transition-colors border border-gray-700 flex items-center gap-1 text-sm cursor-pointer hover:bg-gray-700/80" /* Adjusted padding, hover */
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear all
                  </button>
                </>
              ) : (
                <div className="text-gray-400 text-sm italic">No topics selected. Showing all questions.</div>
              )}
            </div>

            {/* Add Topic Button and Dropdown with improved styling */}
            <div className="relative mt-2">
              <button
                onClick={() => setShowTopicDropdown(!showTopicDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Topic Filter
              </button>
              
              {showTopicDropdown && (
                <div className="absolute mt-2 w-64 bg-gray-800 rounded-xl shadow-lg py-2 z-50 border border-gray-700 max-h-60 overflow-y-auto hide-scrollbar"> {/* Added hide-scrollbar class */}
                  {topics.length > 0 ? (
                    topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => handleTopicSelect(topic)}
                        className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer" /* Added cursor-pointer */
                      >
                        <span className={`flex-shrink-0 w-4 h-4 rounded border ${
                          selectedTopics.includes(topic) 
                            ? 'bg-purple-500 border-purple-500' 
                            : 'border-gray-500'
                        }`}>
                          {selectedTopics.includes(topic) && (
                            <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{topic}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-gray-400 text-sm italic">No topics available</div>
                  )}
                </div>
              )}
            </div>

            {/* Randomize Button with enhanced styling and interaction */}
            <button 
              onClick={user ? handleRandomize : () => setShowLogin(true)}
              disabled={isRandomizing}
              className={`w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3.5 rounded-xl transition-colors duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] relative overflow-hidden group cursor-pointer ${isRandomizing ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 font-medium text-base">
                {isRandomizing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Randomizing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    Randomize Question
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>
        </div>

        {/* Question display with enhanced styling */}
        {isMounted && currentQuestion ? (
          <div className="mt-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg transition-all duration-300 hover:shadow-[0_4px_20px_rgba(79,70,229,0.15)]">
            <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-white leading-tight">
                {currentQuestion.title}
              </h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyStyles(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-4 text-gray-300">
              <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{currentQuestion.topic}</span>
              </div>
              
              {currentQuestion.lastRevised && (
                <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{formatDate(currentQuestion.lastRevised)}</span>
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <Link 
                href={`/${createSlug(currentQuestion.topic)}/${createSlug(currentQuestion.title)}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500/90 to-indigo-500/90 text-white rounded-lg transition-all duration-300 hover:from-blue-600 hover:to-indigo-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 group cursor-pointer"
              >
                View Question
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 p-8 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg text-center">
            {!initialLoadComplete ? (
              <div className="py-10">
                <BeatLoader color="#9333ea" size={15} margin={2} />
                <p className="mt-4 text-gray-300">Loading your questions...</p>
              </div>
            ) : isLoading ? (
              <div className="py-10">
                <BeatLoader color="#9333ea" size={15} margin={2} />
                <p className="mt-4 text-gray-300">Finding the perfect question for you...</p>
              </div>
            ) : questions.length === 0 || (selectedTopics.length > 0 && !questions.some(q => selectedTopics.includes(q.topic))) ? (
              // No Questions Available Message
              <>
                <div className="animate-bounce mb-6">
                  <svg 
                    className="w-16 h-16 mx-auto text-gray-500" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-3">
                  No Questions Found
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  {selectedTopics.length > 0 
                    ? "No questions match your selected topics. Try selecting different topics or add new questions."
                    : "You don't have any questions yet. Click 'Add Questions' to get started."}
                </p>
                {selectedTopics.length > 0 && (
                  <button
                    onClick={handleClearTopics}
                    className="text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-2 mx-auto bg-gray-800/80 px-4 py-2 rounded-lg hover:bg-gray-700/80"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                      />
                    </svg>
                    Clear topic selection
                  </button>
                )}
              </>
            ) : (
              // Ready to Practice Message
              <>
                <div className="animate-pulse mb-6">
                  <svg 
                    className="w-20 h-20 mx-auto text-blue-500" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-gray-300 mb-3">
                  Ready to Practice?
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Click on the Randomize Button to get a question tailored to your practice needs
                </p>
                <div className="flex justify-center">
                  <button 
                    onClick={handleRandomize}
                    disabled={isRandomizing}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                  >
                    {isRandomizing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Finding Question...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Randomize Question</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        
        {/* User stats or tips section */}
        {user && questions.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                You have {questions.length} questions in your collection across {new Set(questions.map(q => q.topic)).size} topics.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
