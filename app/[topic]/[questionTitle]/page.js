'use client';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { auth, db } from '@/components/firebase.config';
import { format, startOfDay } from 'date-fns';
import { get, ref, set, update } from 'firebase/database';

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

// Add this function to parse and render content with images
const renderContent = (content) => {
  if (!content) return null;

  // Split content by image URLs with improved regex
  const parts = content.split(/(https:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif))/gi);

  return parts.map((part, index) => {
    // Check if the part is an image URL with improved regex
    if (part.match(/^https:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif)$/i)) {
      console.log("Found image URL:", part); // Debug log
      return (
        <div key={index} className="my-4"> {/* Keep margin for images */}
          <Image
            src={part}
            width={500} // Keep explicit width for initial render, CSS handles responsiveness
            height={300} // Keep explicit height for initial render
            alt="Problem visualization"
            className="rounded-lg max-w-full h-auto" // Make image responsive
            priority={true}
            unoptimized={true}
          />
        </div>
      );
    }
    // Render regular text content using marked
    return (
      <div
        key={index}
        className="prose-content" // Keep this class if needed elsewhere, prose styles handle the rest
        dangerouslySetInnerHTML={{ __html: marked(part) }}
      />
    );
  });
};

export default function QuestionPage({ params }) {
  const unwrappedParams = React.use(params);
  // State for the left column tabs (Question + Official Solutions)
  const [activeLeftTab, setActiveLeftTab] = useState(0); // 0 for Question, 1+ for solutions
  const [question, setQuestion] = useState(null);
  const [userSolutions, setUserSolutions] = useState([{ code: '', timeComplexity: '' }]);
  const [activeUserSolution, setActiveUserSolution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  // Removed showSolutions state
  const [revealedSolutions, setRevealedSolutions] = useState(new Set());
  const [isRevising, setIsRevising] = useState(false);
  const router = useRouter();

  // Handler for the new left tabs
  const handleLeftTabChange = (index) => {
    setActiveLeftTab(index);
  };

  // Reveal handler adapted for new tab structure
  const handleRevealSolution = (solutionIndex) => {
    setRevealedSolutions(prev => new Set([...prev, solutionIndex]));
  };

  // Modified to handle both revising and un-revising
  const handleRevision = async () => {
    if (!user || !question) return;

    setIsRevising(true);
    const isCurrentlyRevised = !!question.lastRevised;
    const newTimestamp = isCurrentlyRevised ? null : Date.now(); // Set to null if un-revising

    try {
      const today = startOfDay(new Date()).getTime();
      const questionRef = ref(db, `users/${user.uid}/questions/${question.id}`);
      const streakRef = ref(db, `users/${user.uid}/streak/${today}`);

      // Update Firebase question data
      await update(questionRef, {
        lastRevised: newTimestamp
      });

      // Update Firebase streak data
      const streakSnapshot = await get(streakRef);
      if (isCurrentlyRevised) {
        // Decrement streak count if un-revising
        if (streakSnapshot.exists()) {
          const currentCount = streakSnapshot.val().count;
          if (currentCount > 1) {
            await update(streakRef, { count: currentCount - 1 });
          } else {
            // Remove streak entry if count becomes 0
            await set(streakRef, null);
          }
        }
      } else {
        // Increment streak count if revising
        if (streakSnapshot.exists()) {
          await update(streakRef, { count: streakSnapshot.val().count + 1 });
        } else {
          await set(streakRef, { count: 1 });
        }
      }

      // Update local state immediately
      setQuestion(prev => ({
        ...prev,
        lastRevised: newTimestamp
      }));

      // Removed router.push('/')
    } catch (error) {
      console.error('Error updating revision data:', error);
    } finally {
      setIsRevising(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return null;
    return format(timestamp, 'MMM d, yyyy h:mm a');
  };

  useEffect(() => {
    if (question) {
      // Initialize with empty code structure from the question data
      setUserSolutions([{ code: question.empty_code || '', timeComplexity: '' }]);
    }
  }, [question]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchQuestion = async () => {
      setLoading(true); // Start loading
      if (user && unwrappedParams) {
        const questionsRef = ref(db, `users/${user.uid}/questions`);
        try {
          const snapshot = await get(questionsRef);
          if (snapshot.exists()) {
            let foundQuestion = null;
            snapshot.forEach((childSnapshot) => {
              const q = childSnapshot.val();
              if (createSlug(q.topic) === unwrappedParams.topic &&
                  createSlug(q.title) === unwrappedParams.questionTitle) {
                foundQuestion = {
                  id: childSnapshot.key,
                  ...q
                };
              }
            });
            setQuestion(foundQuestion);
          } else {
            setQuestion(null); // No questions found for user
          }
        } catch (error) {
          console.error("Error fetching question:", error);
          setQuestion(null); // Set question to null on error
        }
      } else {
         // Handle case where user or params are not available yet
         if (!user) console.log("Waiting for user auth...");
         if (!unwrappedParams) console.log("Waiting for params...");
      }
      // Only set loading to false after attempting fetch or if conditions aren't met
      if (user && unwrappedParams) {
        setLoading(false);
      } else if (!user) {
         // If user is definitively null (not just loading), stop loading
         const unsubscribe = auth.onAuthStateChanged(currentUser => {
           if (!currentUser) setLoading(false);
         });
         // Cleanup listener if component unmounts before auth state change
         setTimeout(() => unsubscribe(), 5000); // Example timeout
      }
    };

    fetchQuestion();
  }, [user, unwrappedParams]);

  if (loading) {
    // LeetCode-like loading state
    return <div className="min-h-screen p-8 bg-[#1a1a1a] text-gray-400 flex items-center justify-center">Loading...</div>;
  }

  if (!question) {
    // LeetCode-like not found state
    return <div className="min-h-screen p-8 bg-[#1a1a1a] text-gray-400 flex items-center justify-center">Question not found or access denied.</div>;
  }

  return (
    // Reduce horizontal padding, keep vertical padding
    <div className="min-h-screen py-4 sm:py-6 md:py-8 px-2 sm:px-3 md:px-4 bg-[#1a1a1a] text-gray-300">
      {/* Removed max-width container */}
      <div className="mx-auto"> {/* Removed max-w-7xl */}
        {/* Header section with Back Button */}
        <div className="flex items-center gap-3 mb-4">
           <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-700/50 cursor-pointer" /* Adjusted padding/rounding */
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> {/* Adjusted size */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          {/* Title - LeetCode-like style */}
          <h1 className="text-xl md:text-2xl font-medium text-gray-100"> {/* Adjusted size/weight */}
            {question?.title}
          </h1>
        </div>

        {/* Mark as Revised Button - Moved below title/back button */}
        <div className="flex justify-end mb-4"> {/* Reduced margin */}
          <button
            onClick={handleRevision}
            disabled={isRevising}
            className={`
              bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] /* Adjusted offset color */
              text-white px-3 py-1 rounded-md transition-colors duration-200 cursor-pointer /* Adjusted padding, Added cursor-pointer */
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center gap-1 text-xs font-medium shrink-0 /* Adjusted gap */
            `}
          >
          {isRevising ? (
            <>
              {/* Spinner Icon */}
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"> {/* Adjusted size */}
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating...</span>
            </>
          ) : question?.lastRevised ? (
             <>
              {/* Undo Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
              <span>Mark as Unrevised</span>
            </>
          ) : (
            <>
              {/* Checkmark Icon */}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"> {/* Adjusted size */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark as Revised</span>
            </>
          )}
          </button>
        </div>

        {/* Badges - LeetCode-like style */}
        <div className="flex gap-2 gap-y-1 mb-6 items-center flex-wrap"> {/* Reduced margin, Added gap-y-1 */}
          {/* Topic Badge */}
          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-900/70 text-blue-300"> {/* Adjusted padding/rounding/color */}
            {question?.topic}
          </span>
          {/* Difficulty Badge */}
          <span className={`
            px-2.5 py-1 rounded-md text-xs font-medium /* Adjusted padding/rounding */
            ${question?.difficulty.toLowerCase() === 'easy'
              ? 'bg-emerald-900/60 text-emerald-300' // LeetCode green
              : question?.difficulty.toLowerCase() === 'medium'
              ? 'bg-yellow-700/50 text-yellow-300' // LeetCode yellow
              : 'bg-red-800/50 text-red-300'} /* LeetCode red */
          `}>
            {question?.difficulty}
          </span>
          {/* Last Revised Badge */}
          {question?.lastRevised && (
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-900/60 text-sky-300"> {/* Adjusted padding/rounding */}
              Revised: {formatDate(question.lastRevised)}
            </span>
          )}
        </div>

        {/* Main Content Grid - Two Columns on Large Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start"> {/* Increased gap & Added lg:items-start */}

          {/* Left Column: Question + Official Solutions Tabs */}
          <div> {/* Removed space-y-4 */}
            {/* Tab Bar */}
            <div className="flex border-b border-gray-700/80 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50 pb-px mb-4"> {/* Added mb-4 */}
              {/* Question Tab */}
              <button
                onClick={() => handleLeftTabChange(0)}
                className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium whitespace-nowrap transition-colors duration-200 border-b-2 mr-0.5 -mb-px cursor-pointer ${ /* Adjusted padding & font size, Added cursor-pointer */
                  activeLeftTab === 0
                    ? 'text-gray-100 border-gray-100'
                    : 'text-gray-400 hover:text-gray-200 border-transparent hover:border-gray-500'
                }`}
              >
                Question
              </button>
              {/* Official Solution Tabs */}
              {question?.solutions?.map((solution, index) => (
                <button
                  key={index + 1} // Ensure unique key
                  onClick={() => handleLeftTabChange(index + 1)}
                  className={`px-2 md:px-3 py-1.5 text-[11px] md:text-xs font-medium whitespace-nowrap transition-colors duration-200 border-b-2 mr-0.5 -mb-px cursor-pointer ${ /* Adjusted padding & font size, Added cursor-pointer */
                    activeLeftTab === index + 1
                      ? 'text-gray-100 border-gray-100'
                      : 'text-gray-400 hover:text-gray-200 border-transparent hover:border-gray-500'
                  }`}
                >
                  {solution.title || `Solution ${index + 1}`}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-[#282828] rounded-lg border border-gray-700/50 shadow-sm p-5 md:p-6">
              {/* Conditional Rendering based on activeLeftTab */}
              {activeLeftTab === 0 && (
                /* Question Content */
                <div className="prose prose-invert max-w-none prose-sm md:prose-base text-gray-300 prose-pre:p-3 prose-pre:my-3 prose-pre:bg-[#1e1e1e] prose-pre:rounded-md prose-pre:border prose-pre:border-gray-700/50 prose-code:text-[#ce9178] prose-code:before:content-none prose-code:after:content-none prose-code:px-1 prose-code:py-0.5 prose-code:bg-gray-700/50 prose-code:rounded prose-headings:text-gray-100 prose-headings:font-medium prose-headings:mb-3 prose-headings:pb-1 prose-headings:border-b prose-headings:border-gray-700/50 prose-a:text-blue-400 hover:prose-a:text-blue-300">
                  <div className="mb-4">
                    <h2 className="text-base md:text-lg">Description</h2>
                    {renderContent(question?.description)}
                  </div>
                  <div className="mb-4">
                    <h2 className="text-base md:text-lg">Examples</h2>
                    {renderContent(question?.examples)}
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg">Constraints</h2>
                    {renderContent(question?.constraints)}
                  </div>
                </div>
              )}

              {activeLeftTab > 0 && question?.solutions?.[activeLeftTab - 1] && (
                /* Official Solution Content */
                (() => {
                  const solutionIndex = activeLeftTab - 1;
                  const solution = question.solutions[solutionIndex];
                  const isRevealed = revealedSolutions.has(solutionIndex);

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-lg font-medium text-gray-100">{solution.title || `Solution ${solutionIndex + 1}`}</h3>
                         <span className="px-2 py-0.5 rounded bg-sky-900/70 text-sky-300 text-xs font-medium">
                           {solution.timeComplexity}
                         </span>
                      </div>

                      {solution.approach && (
                        <div className="prose prose-invert max-w-none prose-sm md:prose-base text-gray-300">
                          <h4 className="text-sm font-medium mb-1.5 text-gray-200">Approach</h4>
                          <div className="bg-[#1e1e1e] rounded-md p-3 border border-gray-700/50 text-gray-300 text-xs">
                            {solution.approach}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium mb-1.5 text-gray-200">Implementation</h4>
                        <div
                          className="relative group cursor-pointer rounded-md overflow-hidden border border-gray-700/50"
                          onClick={() => !isRevealed && handleRevealSolution(solutionIndex)}
                        >
                          {!isRevealed && (
                            <div className="absolute inset-0 bg-[#282828]/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center transition-opacity duration-300 group-hover:bg-[#282828]/50">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-gray-300 font-medium text-xs">Click to reveal solution</span>
                            </div>
                          )}
                          <div className="h-[300px] md:h-[350px] shadow-sm">
                            <Editor
                              height="100%"
                              value={solution.code}
                              language="python"
                              theme="vs-dark"
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                padding: { top: 10, bottom: 10 },
                                scrollBeyondLastLine: false,
                                wordWrap: "on",
                                automaticLayout: true,
                                roundedSelection: true,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })() // Immediately invoke the function to render the content
              )}
            </div> {/* <-- Added missing closing div here */}
          </div>

          {/* Right Column: User Solutions */}
          <div> {/* Removed lg:mt-10 */}
            {/* Placeholder div to match tab bar height + margin on large screens */}
            <div className="h-8 mb-4 hidden lg:block"></div> {/* Changed h-11 to h-8 */}
            {/* Your Solutions Card - LeetCode-like style */}
            <div className="bg-[#282828] rounded-lg border border-gray-700/50 shadow-sm p-5 md:p-6"> {/* Increased padding */}
              {/* Content inside this card remains the same */}
              <div className="flex justify-between items-center mb-4"> {/* Increased margin */}
                <h2 className="text-lg font-medium text-gray-100">
                  Your Solutions
                </h2>
                {/* Add Solution Button is kept */}
              </div>

              {/* User Solution Tabs - LeetCode-like style */}
              <div className="flex items-center border-b border-gray-700/80 mb-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700/50 pb-px">
                {userSolutions.map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center relative group mr-0.5" // Reduced margin
                  >
                    {/* Tab Button */}
                    <button
                      onClick={() => setActiveUserSolution(index)}
                      className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200 border-b-2 -mb-px ${ /* Adjusted padding/size */
                        activeUserSolution === index
                          ? 'text-gray-100 border-gray-100' // LeetCode active tab
                          : 'text-gray-400 hover:text-gray-200 border-transparent hover:border-gray-500'
                      }`}
                    >
                      Solution {index + 1}
                    </button>
                    {/* Remove Button */}
                    {userSolutions.length > 1 && (
                      <button
                        onClick={() => {
                          const newSolutions = userSolutions.filter((_, i) => i !== index);
                          setUserSolutions(newSolutions);
                          // Adjust active tab if the removed one was active or last
                          if (activeUserSolution === index) {
                            setActiveUserSolution(Math.max(0, index - 1));
                          } else if (activeUserSolution > index) {
                             setActiveUserSolution(activeUserSolution - 1);
                          } else if (activeUserSolution >= newSolutions.length) {
                             setActiveUserSolution(Math.max(0, newSolutions.length - 1));
                          }
                        }}
                        className="ml-0.5 p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-500 hover:text-red-400 hover:bg-gray-700/50 rounded-full transition-all duration-150 text-xs leading-none focus:opacity-100 focus:ring-1 focus:ring-red-500" /* Adjusted size/padding/opacity */
                        aria-label={`Remove Solution ${index + 1}`}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                 {/* Add Solution Button - Moved here */}
                 <button
                  onClick={() => setUserSolutions([...userSolutions, { code: question?.empty_code || '', timeComplexity: '' }])}
                  className="ml-2 mb-px bg-gray-600 hover:bg-gray-500 text-gray-300 w-5 h-5 rounded transition-colors duration-200 flex items-center justify-center text-sm font-light focus:ring-1 focus:ring-gray-400 focus:ring-offset-1 focus:ring-offset-[#282828]" /* Adjusted size/style/position */
                  aria-label="Add new solution"
                >
                  +
                </button>
              </div>

              {/* Code Editor Container - LeetCode-like style */}
              <div className="h-[400px] md:h-[450px] rounded-md overflow-hidden border border-gray-700/50 shadow-sm"> {/* Restored height */}
                <Editor
                  height="100%"
                  value={userSolutions[activeUserSolution]?.code || ''}
                  language="python"
                  theme="vs-dark" // Keep vs-dark theme
                  onChange={(value = '') => {
                    const newSolutions = [...userSolutions];
                    if (newSolutions[activeUserSolution]) {
                      newSolutions[activeUserSolution].code = value;
                      setUserSolutions(newSolutions);
                    } else {
                      console.warn("Attempted to update code for non-existent solution index:", activeUserSolution);
                    }
                  }}
                  options={{
                    fontSize: 13, // Slightly smaller font
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    roundedSelection: true,
                    padding: { top: 10, bottom: 10 }, // Adjusted padding
                    cursorBlinking: "smooth",
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
            {/* Official Solutions section completely removed from the right column */}
          </div> {/* End Right Column */}
        </div> {/* End Main Content Grid */}

      </div> {/* End max-w-7xl container */}
    </div>
  );
}
