'use client';
import Login from '@/components/Login';
import { auth, db } from '@/components/firebase.config';
import { format } from 'date-fns';
import { get, push, ref, update } from 'firebase/database';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

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

          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            
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

        const publicQuestions = Object.entries(publicQuestionsSnapshot.val()).map(([id, data]) => ({
          ...data,
          id
        }));
        
        const userQuestions = userQuestionsSnapshot.exists() 
          ? Object.entries(userQuestionsSnapshot.val()).map(([id, data]) => ({
              ...data,
              id
            }))
          : [];

        // Check for new questions or updated content
        const hasChanges = publicQuestions.some(publicQuestion => {
          const matchingUserQuestion = userQuestions.find(userQuestion => 
            userQuestion.title.toLowerCase() === publicQuestion.title.toLowerCase()
          );

          if (!matchingUserQuestion) {
            console.log('New question found:', publicQuestion.title);
            return true;
          }

          // Compare relevant fields for changes
          const fieldsToCompare = [
            'description',
            'questionLink',
            'examples',
            'constraints',
            'topic',
            'difficulty',
            'empty_code',
            'solutions'
          ];

          const changes = fieldsToCompare.reduce((acc, field) => {
            if (field === 'empty_code' || field === 'solutions') {
              const isDifferent = JSON.stringify(publicQuestion[field]) !== JSON.stringify(matchingUserQuestion[field]);
              if (isDifferent) {
                acc[field] = {
                  public: publicQuestion[field],
                  user: matchingUserQuestion[field]
                };
              }
            } else {
              const isDifferent = publicQuestion[field] !== matchingUserQuestion[field];
              if (isDifferent) {
                acc[field] = {
                  public: publicQuestion[field],
                  user: matchingUserQuestion[field]
                };
              }
            }
            return acc;
          }, {});

          if (Object.keys(changes).length > 0) {
            console.log('Changes detected for question:', publicQuestion.title, changes);
            return true;
          }

          return false;
        });

        console.log('Has changes:', hasChanges);
        setHasNewQuestionsToImport(hasChanges);
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
    
    // Add artificial delay for smooth animation
    setTimeout(() => {
      const filteredQuestions = selectedTopics.length > 0
        ? questions.filter(q => selectedTopics.includes(q.topic))
        : questions;
      
      if (filteredQuestions.length > 0) {
        // Weight questions based on last revision time and difficulty
        const weightedQuestions = filteredQuestions.map(q => {
          let weight = 1;
          
          // Time-based weight
          const now = Date.now();
          const lastRevised = q.lastRevised || 0;
          const daysSinceRevision = (now - lastRevised) / (1000 * 60 * 60 * 24);
          
          // Increase weight for questions not revised recently
          if (daysSinceRevision > 30) weight += 3;
          else if (daysSinceRevision > 14) weight += 2;
          else if (daysSinceRevision > 7) weight += 1;
          
          // Adjust weight based on difficulty
          if (q.difficulty === 'hard') weight *= 1.2;
          if (q.difficulty === 'easy') weight *= 0.8;
          
          return { question: q, weight };
        });

        // Calculate total weight
        const totalWeight = weightedQuestions.reduce((sum, q) => sum + q.weight, 0);
        
        // Generate random value between 0 and total weight
        let random = Math.random() * totalWeight;
        
        // Select question based on weights
        let selectedQuestion = null;
        for (const { question, weight } of weightedQuestions) {
          random -= weight;
          if (random <= 0) {
            selectedQuestion = question;
            break;
          }
        }
        
        // Fallback to first question if something went wrong
        if (!selectedQuestion) {
          selectedQuestion = weightedQuestions[0].question;
        }

        setCurrentQuestion(selectedQuestion);
        
        // Update last revised timestamp
        const questionRef = ref(db, `users/${user.uid}/questions/${selectedQuestion.id}`);
        update(questionRef, {
          lastRevised: Date.now()
        });
      } else {
        setCurrentQuestion(null);
      }
      setIsRandomizing(false);
    }, 800); // Delay for animation
  };

  const handleTopicSelect = (topic) => {
    if (!user) {
      handleAuthRequired();
      return;
    }
    
    setSelectedTopics(prev => {
      if (prev.includes(topic)) {
        // Remove topic if already selected (deselect)
        return prev.filter(t => t !== topic);
      } else {
        // Add topic if not selected
        return [...prev, topic];
      }
    });
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
    if (!user) return;
    
    setIsImporting(true);
    try {
      // Get public questions and user questions
      const [publicQuestionsSnapshot, userQuestionsSnapshot] = await Promise.all([
        get(ref(db, 'public/questions')),
        get(ref(db, `users/${user.uid}/questions`))
      ]);
      
      if (!publicQuestionsSnapshot.exists()) {
        toast.error('No public questions available to import');
        return;
      }

      const publicQuestions = Object.values(publicQuestionsSnapshot.val());
      const userQuestions = userQuestionsSnapshot.exists() 
        ? Object.entries(userQuestionsSnapshot.val()).map(([id, data]) => ({...data, id}))
        : [];

      // Prepare updates object
      const updates = {};
      let newCount = 0;
      let updateCount = 0;

      publicQuestions.forEach(publicQuestion => {
        const matchingUserQuestion = userQuestions.find(uq => 
          uq.title.toLowerCase() === publicQuestion.title.toLowerCase()
        );

        if (!matchingUserQuestion) {
          // New question
          const newQuestionKey = push(ref(db, `users/${user.uid}/questions`)).key;
          updates[`users/${user.uid}/questions/${newQuestionKey}`] = {
            ...publicQuestion,
            importedAt: Date.now()
          };
          newCount++;
        } else {
          // Check if existing question needs updates
          const fieldsToCompare = [
            'description',
            'questionLink',
            'examples',
            'constraints',
            'topic',
            'difficulty',
            'empty_code',
            'solutions'
          ];

          const needsUpdate = fieldsToCompare.some(field => {
            if (field === 'empty_code' || field === 'solutions') {
              return JSON.stringify(publicQuestion[field]) !== JSON.stringify(matchingUserQuestion[field]);
            }
            return publicQuestion[field] !== matchingUserQuestion[field];
          });

          if (needsUpdate) {
            // Preserve user-specific fields
            const preserveFields = ['lastRevised', 'importedAt'];
            const updatedQuestion = {
              ...publicQuestion,
              ...Object.fromEntries(
                preserveFields
                  .filter(field => matchingUserQuestion[field])
                  .map(field => [field, matchingUserQuestion[field]])
              )
            };

            updates[`users/${user.uid}/questions/${matchingUserQuestion.id}`] = updatedQuestion;
            updateCount++;
          }
        }
      });

      if (Object.keys(updates).length === 0) {
        toast.info('No new questions or updates available');
        return;
      }

      // Apply all updates
      await update(ref(db), updates);
      
      // Update state
      setHasNewQuestionsToImport(false);
      
      // Show success message
      const message = [];
      if (newCount > 0) message.push(`${newCount} new questions imported`);
      if (updateCount > 0) message.push(`${updateCount} questions updated`);
      toast.success(message.join(', '));
      
      // Refresh questions list
      const updatedQuestionsSnapshot = await get(ref(db, `users/${user.uid}/questions`));
      if (updatedQuestionsSnapshot.exists()) {
        const questionsData = Object.entries(updatedQuestionsSnapshot.val()).map(([id, question]) => ({
          id,
          ...question
        }));
        setQuestions(questionsData);
      }
    } catch (error) {
      console.error('Error importing questions:', error);
      toast.error('Failed to import questions');
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

  const randomizeButtonVariants = {
    idle: {
      scale: 1,
    },
    randomizing: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <div className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Remove the Lumibyte title section */}
          {/* Remove the Login/Logout Button section */}
        </div>

        {showLogin && <Login onClose={() => setShowLogin(false)} />}

        <div className="space-y-6"> {/* Increased gap from space-y-4 to space-y-6 */}
          {/* Action Buttons with reduced gap */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!user ? (
              <button 
                onClick={handleAuthRequired}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5
                  bg-gradient-to-r from-emerald-600/20 to-emerald-500/20
                  hover:from-emerald-600/30 hover:to-emerald-500/30
                  text-emerald-300 rounded-xl transition-all duration-300 
                  border border-emerald-500/20
                  hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]
                  hover:-translate-y-0.5 group"
              >
                <svg 
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5" 
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
                <span className="font-medium">Add Questions</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Dashboard Button */}
                <Link 
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-4 py-2 bg-gray-800/80 hover:bg-gray-800/90 text-blue-300 rounded-xl transition-all duration-300 border border-blue-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Dashboard
                </Link>

                <Link 
                  href="/questions"
                  className="inline-flex items-center justify-center px-4 py-2 bg-gray-800/80 hover:bg-gray-800/90 text-emerald-300 rounded-xl transition-all duration-300 border border-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:-translate-y-0.5"
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
                    className="inline-flex items-center justify-center px-4 py-2 bg-gray-800/80 hover:bg-gray-800/90 text-rose-300 rounded-xl transition-all duration-300 border border-rose-500/20 hover:shadow-[0_0_20px_rgba(244,63,94,0.1)] hover:-translate-y-0.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Admin
                  </Link>
                )}

                {hasNewQuestionsToImport && (
                  <button 
                    onClick={handleImportQuestions}
                    disabled={isImporting}
                    className={`
                      inline-flex items-center justify-center gap-2 px-4 py-2
                      bg-gradient-to-r from-emerald-600/20 to-teal-500/20
                      hover:from-emerald-600/30 hover:to-teal-500/30
                      text-emerald-300 rounded-xl transition-all duration-300 
                      border border-emerald-500/20
                      hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]
                      hover:-translate-y-0.5 group
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                      disabled:hover:shadow-none disabled:hover:from-emerald-600/20 disabled:hover:to-teal-500/20
                    `}
                  >
                    {isImporting ? (
                      <>
                        <svg 
                          className="animate-spin w-4 h-4" 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle 
                            className="opacity-25" 
                            cx="12" 
                            cy="12" 
                            r="10" 
                            stroke="currentColor" 
                            strokeWidth="4"
                          />
                          <path 
                            className="opacity-75" 
                            fill="currentColor" 
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span className="font-medium">Importing...</span>
                      </>
                    ) : (
                      <>
                        <svg 
                          className="w-4 h-4 transition-transform group-hover:translate-y-0.5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
                          />
                        </svg>
                        <span className="font-medium">Import Questions</span>
                      </>
                    )}
                  </button>
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

          {/* Topic filtering section with reduced padding */}
          <div className="relative z-20 space-y-3 bg-gray-800/30 backdrop-blur-sm p-3 rounded-xl border border-gray-700/50">
            <h2 className="text-lg font-medium text-white/90 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Filter by Topics
            </h2>

            {/* Minimal Topic Filter */}
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(topic)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm transition-all duration-200
                      hover:scale-105 active:scale-100
                      ${selectedTopics.includes(topic)
                        ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:text-purple-300 hover:bg-gray-800/80'
                      }
                    `}
                  >
                    {topic}
                  </button>
                ))}
                
                {selectedTopics.length > 0 && (
                  <button
                    onClick={handleClearTopics}
                    className="px-3 py-1.5 rounded-full text-sm bg-red-500/10 
                      text-red-400 hover:bg-red-500/20 transition-all duration-200
                      hover:scale-105 active:scale-100"
                  >
                    Clear all
                  </button>
                )}
                
                {topics.length === 0 && (
                  <span className="text-sm text-gray-500 italic">
                    No topics available
                  </span>
                )}
              </div>

              {/* Selected Topics Count */}
              {selectedTopics.length > 0 && (
                <div className="mt-2 text-sm text-gray-500">
                  {selectedTopics.length} topic{selectedTopics.length > 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            {/* Randomize Button with enhanced styling and interaction */}
            <motion.button 
              onClick={user ? handleRandomize : () => setShowLogin(true)}
              disabled={isRandomizing}
              variants={randomizeButtonVariants}
              animate={isRandomizing ? "randomizing" : "idle"}
              className={`
                w-full bg-gray-800/80 hover:bg-gray-800/90
                text-purple-300 px-6 py-3.5 rounded-xl transition-all duration-300 
                hover:shadow-[0_0_20px_rgba(147,51,234,0.1)]
                border border-purple-500/20
                relative overflow-hidden group 
                ${isRandomizing ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}
              `}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 font-medium text-base">
                {isRandomizing ? (
                  <>
                    <motion.svg 
                      className="w-5 h-5"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
                    </motion.svg>
                    <span className="animate-pulse">Finding the perfect question...</span>
                  </>
                ) : (
                  <>
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
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    <span>Randomize Question</span>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          </div>
        </div>

        {/* Question display with optimized spacing */}
        {isMounted && currentQuestion ? (
          <div className="mt-4 p-4 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg transition-all duration-300 hover:shadow-[0_4px_20px_rgba(79,70,229,0.15)]">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 
                  bg-gray-800/80 hover:bg-gray-800/90
                  text-blue-300 rounded-lg transition-all duration-300 
                  border border-blue-500/20
                  hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]
                  hover:-translate-y-0.5 group"
              >
                View Question
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
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 
            hover:shadow-[0_4px_20px_rgba(79,70,229,0.15)] transition-all duration-300">
            <div className="flex flex-col items-center py-4">
              {/* Ready to Practice content with reduced vertical spacing */}
              <div className="mb-4 relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                <svg 
                  className="w-14 h-14 text-indigo-400 relative animate-bounce-slow" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
              </div>

              <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 
                bg-clip-text text-transparent mb-2">
                Ready to Practice?
              </h3>
              <p className="text-gray-400 text-center mb-4 max-w-md text-sm">
                Click on the Randomize Button to get a question tailored to your practice needs
              </p>

              <button 
                onClick={handleRandomize}
                disabled={isRandomizing}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5
                  bg-gradient-to-r from-indigo-600/20 to-purple-600/20
                  hover:from-indigo-600/30 hover:to-purple-600/30
                  text-indigo-300 rounded-xl transition-all duration-300 
                  border border-indigo-500/20
                  hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]
                  hover:-translate-y-0.5 group
                  disabled:opacity-50 disabled:cursor-not-allowed 
                  disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <span>Randomize Question</span>
              </button>
            </div>
          </div>
        )}
        
        {/* User stats or tips section */}
        {user && questions.length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 text-gray-400 text-sm">
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
