'use client';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
        <div key={index} className="my-4"> {/* Removed 'flex justify-center' */}
          <Image
            src={part}
            width={500}
            height={300}
            alt="Problem visualization"
            className="rounded-lg"
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
        className="prose-content"
        dangerouslySetInnerHTML={{ __html: marked(part) }} 
      />
    );
  });
};

export default function QuestionPage({ params }) {
  const unwrappedParams = React.use(params);
  // Removed showSolution state as layout is now grid-based
  const [activeTab, setActiveTab] = useState(0);
  const [question, setQuestion] = useState(null);
  const [userSolutions, setUserSolutions] = useState([{ code: '', timeComplexity: '' }]);
  const [activeUserSolution, setActiveUserSolution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showSolutions, setShowSolutions] = useState(false); // Keep state for toggling official solutions
  const [revealedSolutions, setRevealedSolutions] = useState(new Set());
  const [isRevising, setIsRevising] = useState(false);
  const router = useRouter();

  const handleTabChange = (index) => {
    setActiveTab(index);
  };

  const handleRevealSolution = (index) => {
    setRevealedSolutions(prev => new Set([...prev, index]));
  };

  const handleRevision = async () => {
    if (!user || !question) return;
    
    setIsRevising(true);
    try {
      const timestamp = Date.now();
      const today = startOfDay(new Date()).getTime();
      
      // Update question's last revised timestamp
      const questionRef = ref(db, `users/${user.uid}/questions/${question.id}`);
      await update(questionRef, {
        lastRevised: timestamp
      });

      // Update streak data
      const streakRef = ref(db, `users/${user.uid}/streak/${today}`);
      const streakSnapshot = await get(streakRef);
      
      if (streakSnapshot.exists()) {
        // Increment existing count
        await update(streakRef, {
          count: streakSnapshot.val().count + 1
        });
      } else {
        // Initialize new date entry
        await set(streakRef, {
          count: 1
        });
      }

      // Update local state
      setQuestion(prev => ({
        ...prev,
        lastRevised: timestamp
      }));
      
      // Optionally redirect to home
      router.push('/');
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
         // Depending on logic, you might want to wait or set question to null
         if (!user) console.log("Waiting for user auth...");
         if (!unwrappedParams) console.log("Waiting for params...");
         // Keep loading until user and params are available
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
    // Consistent dark theme loading state
    return <div className="min-h-screen p-8 bg-gray-900 text-gray-100 flex items-center justify-center">Loading...</div>;
  }

  if (!question) {
    // Consistent dark theme not found state
    return <div className="min-h-screen p-8 bg-gray-900 text-gray-100 flex items-center justify-center">Question not found or access denied.</div>;
  }

  return (
    // Dark theme base: bg-gray-900, text-gray-100. Responsive padding.
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-900 text-gray-100">
      {/* Max-width container */}
      <div className="max-w-7xl mx-auto">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6"> {/* Reduced margin */}
          {/* Title - Dark theme style */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-100 mb-3 sm:mb-0"> {/* Slightly smaller title */}
            {question?.title}
          </h1>

          {/* Mark as Revised Button - Dark theme style */}
          <button
            onClick={handleRevision}
            disabled={isRevising}
            className={`
              bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-gray-900
              text-white px-4 py-1.5 rounded-md transition-colors duration-200 /* Adjusted padding/rounding */
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center gap-1.5 text-xs font-medium shrink-0 /* Adjusted gap/size */
            `}
          >
          {isRevising ? (
            <>
              {/* Spinner Icon */}
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating...</span>
            </>
          ) : (
            <>
              {/* Checkmark Icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark as Revised</span>
            </>
          )}
          </button>
        </div>

        {/* Badges - Dark theme style */}
        <div className="flex gap-2 mb-8 items-center flex-wrap"> {/* Reduced gap/margin */}
          {/* Topic Badge */}
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600"> {/* Adjusted padding */}
            {question?.topic}
          </span>
          {/* Difficulty Badge */}
          <span className={`
            px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-300 /* Adjusted padding */
            ${question?.difficulty.toLowerCase() === 'easy' 
              ? 'bg-green-900/50 text-green-300 border-green-700' 
              : question?.difficulty.toLowerCase() === 'medium'
              ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
              : 'bg-red-900/50 text-red-300 border-red-700'}
          `}>
            {question?.difficulty}
          </span>
          {/* Last Revised Badge */}
          {question?.lastRevised && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700"> {/* Adjusted padding */}
              Revised: {formatDate(question.lastRevised)}
            </span>
          )}
        </div>

        {/* Main Content Grid - Two Columns on Large Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* Reduced gap */}
          
          {/* Left Column: Problem Details */}
          <div className="space-y-6"> {/* Reduced space */}
            {/* Question Content Card - Dark theme style */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-md p-5 md:p-6"> {/* Adjusted padding/rounding */}
              {/* Prose styles for dark theme - Further adjusted pre styling for seamless look */}
              <div className="prose prose-invert max-w-none prose-sm md:prose-base prose-pre:p-0 prose-pre:my-2 prose-pre:bg-transparent prose-pre:border-none prose-code:text-pink-400 prose-headings:text-gray-100 prose-headings:font-semibold prose-headings:mb-3 prose-headings:pb-2 prose-headings:border-b prose-headings:border-gray-600 prose-a:text-blue-400 hover:prose-a:text-blue-300">
                <div> {/* Removed mb-6 */}
                  <h2 className="text-lg md:text-xl">Description</h2>
                  {renderContent(question?.description)}
                </div>

                <div> {/* Removed mb-6 */}
                  <h2 className="text-lg md:text-xl">Examples</h2>
                  {renderContent(question?.examples)}
                </div>

                <div>
                  <h2 className="text-lg md:text-xl">Constraints</h2>
                  {renderContent(question?.constraints)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Solutions */}
          <div className="space-y-6"> {/* Reduced space */}
            {/* Your Solutions Card - Dark theme style */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-md p-5 md:p-6"> {/* Adjusted padding/rounding */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-100"> {/* Adjusted size */}
                  Your Solutions
                </h2>
                {/* Add Solution Button - Dark theme style */}
                <button
                  onClick={() => setUserSolutions([...userSolutions, { code: question?.empty_code || '', timeComplexity: '' }])}
                  className="bg-green-600 hover:bg-green-700 text-white w-7 h-7 rounded-md transition-colors duration-200 flex items-center justify-center text-lg font-light focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800" /* Adjusted size/rounding */
                  aria-label="Add new solution"
                >
                  +
                </button>
              </div>

              {/* Solution Tabs - Dark theme style */}
              <div className="flex border-b border-gray-600 mb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700 pb-px">
                {userSolutions.map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center relative group mr-1"
                  >
                    {/* Tab Button */}
                    <button
                      onClick={() => setActiveUserSolution(index)}
                      className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2 ${ /* Adjusted padding */
                        activeUserSolution === index 
                          ? 'text-blue-400 border-blue-400' 
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
                        className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 hover:bg-gray-700 rounded-full transition-all duration-200 text-base leading-none focus:opacity-100 focus:ring-1 focus:ring-red-500" /* Adjusted size/padding */
                        aria-label={`Remove Solution ${index + 1}`}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Code Editor Container - Dark theme style */}
              {/* Adjusted height slightly */}
              <div className="h-[400px] md:h-[450px] rounded-md overflow-hidden border border-gray-600 shadow-md"> 
                <Editor
                  height="100%"
                  value={userSolutions[activeUserSolution]?.code || ''}
                  language="python"
                  theme="vs-dark" // Ensure dark theme for editor
                  onChange={(value = '') => {
                    const newSolutions = [...userSolutions];
                    if (newSolutions[activeUserSolution]) {
                      newSolutions[activeUserSolution].code = value;
                      setUserSolutions(newSolutions);
                    } else {
                      // Handle case where activeUserSolution might be out of bounds briefly after deletion
                      console.warn("Attempted to update code for non-existent solution index:", activeUserSolution);
                    }
                  }}
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    roundedSelection: true,
                    padding: { top: 12, bottom: 12 }, // Adjusted padding
                    cursorBlinking: "smooth",
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>

            {/* Show/Hide Official Solutions Section */}
            {!showSolutions && (
              <div className="flex items-start justify-center">
                {/* Show Solutions Button - Dark theme style */}
                <button 
                  onClick={() => setShowSolutions(true)}
                  className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white px-5 py-2 rounded-md transition-colors duration-200 w-full sm:w-auto font-medium text-sm" /* Adjusted padding/size */
                >
                  Show Official Solutions
                </button>
              </div>
            )}

            {/* Official Solutions Card - Dark theme style */}
            {showSolutions && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-md p-5 md:p-6 animate-fadeInUp"> {/* Adjusted padding/rounding */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-100"> {/* Adjusted size */}
                    Official Solutions
                  </h2>
                  {/* Hide Solutions Button - Dark theme style */}
                  <button 
                    onClick={() => setShowSolutions(false)}
                    className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-700 focus:ring-1 focus:ring-gray-500" /* Adjusted padding */
                    aria-label="Hide Solutions"
                  >
                    {/* Close Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Solution Tabs - Dark theme style */}
                <div className="flex border-b border-gray-600 mb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700 pb-px">
                  {question.solutions?.map((solution, index) => ( 
                    <button
                      key={index}
                      onClick={() => handleTabChange(index)}
                      className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2 mr-1 ${ /* Adjusted padding */
                        activeTab === index
                          ? 'text-blue-400 border-blue-400'
                          : 'text-gray-400 hover:text-gray-200 border-transparent hover:border-gray-500'
                      }`}
                    >
                      {solution.title || `Solution ${index + 1}`}
                    </button>
                  ))}
                </div>

                {/* Active Solution Content */}
                {question.solutions?.[activeTab] && ( 
                  <div className="space-y-4"> {/* Reduced space */}
                    <div className="flex items-center justify-end">
                      {/* Time Complexity Badge - Dark theme style */}
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-900/70 text-blue-300 text-xs font-medium border border-blue-700"> {/* Adjusted padding */}
                        {question.solutions[activeTab].timeComplexity}
                      </span>
                    </div>

                    {/* Solution Approach - Dark theme style */}
                    {question.solutions[activeTab].approach && (
                      <div className="prose prose-invert max-w-none prose-sm md:prose-base">
                        <h4 className="text-base font-medium mb-2 text-gray-200">Approach</h4>
                        <div className="bg-gray-700/50 rounded-md p-3 border border-gray-600 text-gray-300 text-sm"> {/* Adjusted padding/size */}
                          {question.solutions[activeTab].approach}
                        </div>
                      </div>
                    )}

                    {/* Solution Code */}
                    <div>
                      <h4 className="text-base font-medium mb-2 text-gray-200">Implementation</h4>
                      <div 
                        className="relative group cursor-pointer rounded-md overflow-hidden border border-gray-600" 
                        onClick={() => !revealedSolutions.has(activeTab) && handleRevealSolution(activeTab)}
                      >
                        {/* Blur Overlay - Dark theme style */}
                        {!revealedSolutions.has(activeTab) && (
                          <div className="absolute inset-0 bg-gray-800/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center transition-opacity duration-300 group-hover:bg-gray-800/40"> {/* Adjusted overlay */}
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"> {/* Adjusted size */}
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span className="text-gray-300 font-medium text-xs">Click to reveal solution</span> {/* Adjusted size */}
                          </div>
                        )}

                        {/* Code Editor Container - Dark theme */}
                        <div className="h-[300px] md:h-[350px] shadow-md"> {/* Adjusted height */}
                          <Editor
                            height="100%"
                            value={question.solutions[activeTab].code}
                            language="python"
                            theme="vs-dark" // Ensure dark theme
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              fontSize: 13, 
                              padding: { top: 12, bottom: 12 }, // Adjusted padding
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
                )}
              </div>
            )}
          </div> {/* End Right Column */}
        </div> {/* End Main Content Grid */}

        {/* Removed redundant Mark as Revised button at the bottom */}
        
      </div> {/* End max-w-7xl container */}
    </div>
  );
}
