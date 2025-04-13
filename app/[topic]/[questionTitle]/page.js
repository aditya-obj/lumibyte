'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { format, startOfDay } from 'date-fns';
import { get, ref, set, update } from 'firebase/database';
import { marked } from 'marked';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { PulseLoader } from 'react-spinners';
import Breadcrumbs from '@/components/Breadcrumbs';
import Link from 'next/link';

// Add the splitExamples function at the top level
const splitExamples = (examples) => {
  if (!examples) return [];

  // Match "Example N:" pattern and remove it from the content
  const matches = examples.match(/Example \d+:[\s\S]*?(?=Example \d+:|$)/g) || [];

  return matches.map(example =>
    example.replace(/^Example \d+:\s*/, '').trim() // Remove the "Example N:" prefix
  );
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

// Add this function to parse and render content with images
const renderContent = (content) => {
  if (!content) return null;
  // Updated regex to match LeetCode image URLs more precisely
  const parts = content.split(/(\bhttps:\/\/assets\.leetcode\.com\/uploads\/[^\s)]+\.(?:jpg|jpeg|png|gif))/i);

  return parts.map((part, index) => {
    // Updated condition to match LeetCode assets
    if (part.match(/^https:\/\/assets\.leetcode\.com\/uploads\/[^\s)]+\.(?:jpg|jpeg|png|gif)/i)) {
      return (
        <div key={index} className="my-6 flex justify-center">
          <Image
            src={part}
            alt="Problem visualization"
            width={500}
            height={300}
            className="rounded-xl shadow-lg max-w-full h-auto"
            priority={true}
            unoptimized={false} // Changed to false to enable optimization
          />
        </div>
      );
    }
    return (
      <div
        key={index}
        className="question-content"
        dangerouslySetInnerHTML={{
          __html: marked(part, {
            highlight: (code, lang) => {
              return Prism.highlight(code, Prism.languages[lang || 'text'], lang || 'text');
            }
          })
        }}
      />
    );
  });
};

// Add this helper function to format constraints
const formatConstraints = (constraints) => {
  if (!constraints) return '';

  // Add line breaks between constraints if they don't already exist
  return constraints
    .replace(/•/g, '\n•') // Add line break before bullet points
    .replace(/([.।])\s*(?=[A-Z0-9])/g, '$1\n') // Add line break after periods followed by capital letters or numbers
    .split('\n')
    .filter(line => line.trim())
    .join('\n\n'); // Add extra line break between constraints
};

const parseExamples = (examplesMarkdown) => {
  if (!examplesMarkdown) return [];
  
  // Match "Example N:" pattern and split the content
  const examples = examplesMarkdown.match(/Example \d+:[\s\S]*?(?=Example \d+:|$)/g) || [];
  
  return examples.map(example => {
    // Extract example number
    const numberMatch = example.match(/Example (\d+):/);
    const number = numberMatch ? numberMatch[1] : '';
    
    // Extract input and output using regex
    const inputMatch = example.match(/Input[^\[]*(\[.*\])/);
    const outputMatch = example.match(/Output[^\[]*(\[.*\])/);
    
    return {
      number,
      input: inputMatch ? inputMatch[1].trim() : '',
      output: outputMatch ? outputMatch[1].trim() : ''
    };
  });
};

// Add this resize handle component
const ResizeHandle = () => {
  return (
    <PanelResizeHandle className="w-2 transition-colors cursor-col-resize relative group">
      <div className="h-full flex items-center justify-center relative">
        {/* Default thicker gray line in middle that disappears on hover */}
        <div className="w-[3px] h-[24px] bg-[#2a2a2a] transition-opacity group-hover:opacity-0" />
        
        {/* Full height blue line on hover */}
        <div className="absolute w-[3px] h-full bg-[#0084ff] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </PanelResizeHandle>
  );
};

// First, add a horizontal resize handle component
const HorizontalResizeHandle = () => {
  return (
    <PanelResizeHandle className="h-4 transition-colors cursor-row-resize relative group">
      <div className="w-full h-full flex justify-center items-center relative">
        {/* Default gray line with gap */}
        <div className="h-[2px] w-[24px] bg-[#2a2a2a] transition-opacity group-hover:opacity-0" />
        
        {/* Full width blue line on hover that fills the gap */}
        <div className="absolute h-[2px] w-full bg-[#0084ff] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </PanelResizeHandle>
  );
};

export default function QuestionPage({ params }) {
  const unwrappedParams = React.use(params);
  const [mobileView, setMobileView] = useState('description');
  const [editorReady, setEditorReady] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState(0);
  const [question, setQuestion] = useState(null);
  const [userSolutions, setUserSolutions] = useState([{ code: '', timeComplexity: '' }]);
  const [activeUserSolution, setActiveUserSolution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [revealedSolutions, setRevealedSolutions] = useState(new Set());
  const [isRevising, setIsRevising] = useState(false);
  const [activeTab, setActiveTab] = useState('testCases');
  const router = useRouter();
  const [previousPath, setPreviousPath] = useState('/');
  const [blurredSolutions, setBlurredSolutions] = useState(() => {
    // Initialize with all possible solution indices blurred
    return new Set(Array.from({ length: 20 }, (_, i) => i)); // Increase the initial size to be safe
  });
  const [isTestCasesExpanded, setIsTestCasesExpanded] = useState(false);

  // Language selection states
  const [availableSolutionLanguages, setAvailableSolutionLanguages] = useState(['python']);
  const [selectedSolutionLanguage, setSelectedSolutionLanguage] = useState('python');
  const [availableCodeLanguages, setAvailableCodeLanguages] = useState(['python']);
  const [selectedCodeLanguage, setSelectedCodeLanguage] = useState('python');

  // Add this function to handle blur toggling
  const toggleSolutionBlur = (solutionIndex) => {
    setBlurredSolutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(solutionIndex)) {
        newSet.delete(solutionIndex);
      } else {
        newSet.add(solutionIndex);
      }
      return newSet;
    });
  };

  // Add this useEffect to capture the previous path when component mounts
  useEffect(() => {
    const referrer = document.referrer;
    if (referrer.includes('/dashboard')) {
      setPreviousPath('/dashboard');
    } else if (referrer.includes('/edit/question')) {
      setPreviousPath('/dashboard');
    } else {
      setPreviousPath('/');
    }
  }, []);

  // Handler for the new left tabs
  const handleLeftTabChange = (index) => {
    setActiveLeftTab(index);
  };

  // Handler for solution language selection
  const handleSolutionLanguageChange = (language) => {
    setSelectedSolutionLanguage(language);
  };

  // Handler for code language selection
  const handleCodeLanguageChange = (language) => {
    setSelectedCodeLanguage(language);
    if (question?.empty_code?.[language]) {
      setUserSolutions([{ code: question.empty_code[language], timeComplexity: '' }]);
    }
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
      // Detect available languages for solutions
      if (question.solutions) {
        const solutionLangs = Object.keys(question.solutions);
        if (solutionLangs.length > 0) {
          setAvailableSolutionLanguages(solutionLangs);
          setSelectedSolutionLanguage(solutionLangs[0]);
        }
      }

      // Detect available languages for empty code
      if (question.empty_code) {
        const codeLangs = Object.keys(question.empty_code);
        if (codeLangs.length > 0) {
          setAvailableCodeLanguages(codeLangs);
          setSelectedCodeLanguage(codeLangs[0]);

          // Initialize with empty code structure from the question data
          const emptyCode = question.empty_code[codeLangs[0]] || '';
          setUserSolutions([{ code: emptyCode, timeComplexity: '' }]);
        } else {
          // Fallback for old structure
          setUserSolutions([{ code: question.empty_code || '', timeComplexity: '' }]);
        }
      } else {
        setUserSolutions([{ code: '', timeComplexity: '' }]);
      }
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
    return (
      <div className="min-h-screen p-8 bg-[#1a1a1a] text-gray-400 flex flex-col items-center justify-center">
        <PulseLoader color="#9333ea" size={15} margin={2} />
        <p className="mt-4 text-sm text-gray-400">Loading question...</p>
      </div>
    );
  }

  if (!question) {
    // LeetCode-like not found state
    return <div className="min-h-screen p-8 bg-[#1a1a1a] text-gray-400 flex items-center justify-center">Question not found or access denied.</div>;
  }

  const handleBackClick = () => {
    router.push(previousPath);
  };

  const handleTestCasesExpand = () => {
    setIsTestCasesExpanded(!isTestCasesExpanded);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Breadcrumbs previousPath={previousPath} />
      {/* Top Navigation Bar */}


      {/* Problem Info Bar - Sticky on mobile */}
      <div className="sticky top-14 sm:top-16 z-40 bg-[#0a0a0a] py-2 lg:py-4 px-4">
        <div className="flex flex-wrap items-center justify-between">
          {/* Left side - Difficulty and Topic */}
          <div className="flex flex-wrap items-center gap-2">
            <div className={`px-2 py-1 rounded-md text-xs font-medium
              ${question?.difficulty?.toLowerCase() === 'easy'
                ? 'bg-green-500/10 text-green-500'
                : question?.difficulty?.toLowerCase() === 'medium'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-red-500/10 text-red-500'}`}>
              {question?.difficulty}
            </div>
            <div className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400">
              {question?.topic}
            </div>
            
            {/* Link button */}
            {question?.questionLink && (
              <a
                href={question.questionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium 
                  bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Link
              </a>
            )}
          </div>

          {/* Right side - Revise, Link and Edit buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRevision}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium 
                ${question?.lastRevised 
                  ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' 
                  : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'} 
                transition-colors`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {question?.lastRevised ? 'Revised' : 'Mark as Revised'}
            </button>

            {user && question && (
              <Link
                href={`/${unwrappedParams.topic}/${unwrappedParams.questionTitle}/edit?id=${question.id}`}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium 
                  bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-0"> {/* Changed from mx-2 to mx-0 */}
        {/* Mobile Layout */}
        <div className="lg:hidden h-[calc(100vh-8rem)]">
          {mobileView === 'description' ? (
            <div className="h-full flex flex-col bg-[#1a1a1a] overflow-hidden">
              {/* Tabs */}
              <div className="flex overflow-x-auto hide-scrollbar border-b border-[#2a2a2a]">
                <div className="flex whitespace-nowrap min-w-max">
                  <button
                    className={`px-4 py-3 text-sm font-medium ${
                      activeLeftTab === 0 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                    }`}
                    onClick={() => handleLeftTabChange(0)}
                  >
                    Description
                  </button>
                  <button
                    className={`px-4 py-3 text-sm font-medium ${
                      activeLeftTab === 1 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                    }`}
                    onClick={() => handleLeftTabChange(1)}
                  >
                    Brute Force
                  </button>
                  <button
                    className={`px-4 py-3 text-sm font-medium ${
                      activeLeftTab === 2 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                    }`}
                    onClick={() => handleLeftTabChange(2)}
                  >
                    Optimal
                  </button>
                  <button
                    className={`px-4 py-3 text-sm font-medium ${
                      activeLeftTab === 3 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                    }`}
                    onClick={() => handleLeftTabChange(3)}
                  >
                    Space-Time
                  </button>
                  <button
                    className={`px-4 py-3 text-sm font-medium ${
                      activeLeftTab === 4 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
                    }`}
                    onClick={() => handleLeftTabChange(4)}
                  >
                    Follow-up
                  </button>
                </div>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4 space-y-6">
                  <div>
                    <h2 className="text-white text-lg font-medium mb-3">Problem Description</h2>
                    <div className="question-content">
                      {renderContent(question?.description)}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-white text-lg font-medium mb-3">Examples</h2>
                    <div className="question-content">
                      {renderContent(question?.examples)}
                    </div>
                  </div>

                  {question?.constraints && (
                    <div>
                      <h2 className="text-white text-lg font-medium mb-3">Constraints</h2>
                      <div className="question-content">
                        {renderContent(formatConstraints(question?.constraints))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <MobileEditor
              userSolutions={userSolutions}
              activeUserSolution={activeUserSolution}
              selectedCodeLanguage={selectedCodeLanguage}
              availableCodeLanguages={availableCodeLanguages}
              handleCodeLanguageChange={handleCodeLanguageChange}
            />
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:block h-[calc(100vh-8rem)]">
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col bg-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="border-b border-[#2a2a2a] flex flex-col">
                  {/* Language selector */}
                  {availableSolutionLanguages.length > 1 && (
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
                      <span className="text-sm text-gray-400">Language:</span>
                      <div className="relative">
                        <select
                          value={selectedSolutionLanguage}
                          onChange={(e) => handleSolutionLanguageChange(e.target.value)}
                          className="bg-[#2a2a2a] text-white text-sm rounded-md px-3 py-1 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {availableSolutionLanguages.map(lang => (
                            <option key={lang} value={lang}>
                              {lang.charAt(0).toUpperCase() + lang.slice(1)}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex overflow-x-auto custom-scrollbar">
                    <button
                      onClick={() => handleLeftTabChange(0)}
                      className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                        ${activeLeftTab === 0 ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      Description
                      {activeLeftTab === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                      )}
                    </button>
                    {question?.solutions?.[selectedSolutionLanguage] ?
                      Object.keys(question.solutions[selectedSolutionLanguage]).map((key, index) => (
                      <button
                        key={index + 1}
                        onClick={() => handleLeftTabChange(index + 1)}
                        className={`px-4 sm:px-6 py-3 text-sm font-medium transition-colors relative whitespace-nowrap
                          ${activeLeftTab === index + 1 ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        {question.solutions[selectedSolutionLanguage][key].title || `Solution ${index + 1}`}
                        {activeLeftTab === index + 1 && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                        )}
                      </button>
                    )) : null}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  {activeLeftTab === 0 ? (
                    <div className="prose prose-invert max-w-none">
                      <div className="space-y-6">
                        {/* Problem Description */}
                        <div>
                          <h3 className="text-lg font-medium text-white mb-4">Problem Description</h3>
                          {renderContent(question?.description)}
                        </div>

                        {/* Examples */}
                        <div>
                          <h3 className="text-lg font-medium text-white mb-4">Examples</h3>
                          <div className="space-y-6">
                            {splitExamples(question?.examples).map((example, index) => (
                              <div key={index} className="space-y-2">
                                <div className="inline-block bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded text-sm font-medium">
                                  Example {index + 1}
                                </div>
                                {renderContent(example)}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Constraints */}
                        <div className="mb-8">
                          <h3 className="text-lg font-medium text-white mb-4">Constraints</h3>
                          {renderContent(formatConstraints(question?.constraints))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none">
                      {question?.solutions?.[selectedSolutionLanguage] && (() => {
                        const solutionKeys = Object.keys(question.solutions[selectedSolutionLanguage]);
                        if (solutionKeys.length >= activeLeftTab) {
                          const key = solutionKeys[activeLeftTab - 1];
                          const solution = question.solutions[selectedSolutionLanguage][key];
                          return (
                        <>
                          <div className="mb-6">
                            <h4 className="text-base sm:text-lg font-medium text-white mb-3">Explanation</h4>
                            {renderContent(solution.explanation)}
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-base sm:text-lg font-medium text-white">Solution</h4>
                              <button
                                onClick={() => toggleSolutionBlur(activeLeftTab - 1)}
                                className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700/50"
                                title={blurredSolutions.has(activeLeftTab - 1) ? "Show Solution" : "Hide Solution"}
                              >
                                {blurredSolutions.has(activeLeftTab - 1) ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            <div className={`h-[300px] bg-[#282c34] rounded-lg overflow-hidden relative ${blurredSolutions.has(activeLeftTab - 1) ? 'select-none' : ''}`}>
                              <Editor
                                height="100%"
                                value={solution.code}
                                language={selectedSolutionLanguage}
                                theme="vs-dark"
                                options={{
                                  fontSize: 14,
                                  minimap: { enabled: false },
                                  scrollBeyondLastLine: false,
                                  padding: { top: 16, bottom: 16 },
                                  lineNumbers: 'on',
                                  readOnly: true,
                                  wordWrap: 'on',
                                  automaticLayout: true,
                                }}
                              />
                              {blurredSolutions.has(activeLeftTab - 1) && (
                                <div
                                  className="absolute inset-0 backdrop-blur-md bg-gray-800/30 flex items-center justify-center cursor-pointer"
                                  onClick={() => toggleSolutionBlur(activeLeftTab - 1)}
                                >
                                  <span className="text-gray-300 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Click to reveal solution
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                        );
                      }
                      return null;
                    })()}
                    </div>
                  )}
                </div>
              </div>
            </Panel>
            
            <ResizeHandle />
            
            <Panel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col bg-[#1a1a1a] rounded-xl overflow-hidden">
                {/* Solution Editor Section */}
                <PanelGroup direction="vertical">
                  <Panel 
                    defaultSize={60}  // Reduced further
                    minSize={25}      // Reduced minimum size
                    maxSize={75}      // Adjusted maximum size
                  >
                    <div className="h-full flex flex-col">
                      <div className="border-b border-[#2a2a2a] flex flex-col">
                        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h2 className="text-white font-medium text-sm sm:text-base">Your Solution</h2>
                          </div>
                          <button className="px-3 sm:px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer">
                            Run
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-[400px]">
                        <Editor
                          height="100%"
                          value={userSolutions[activeUserSolution]?.code || ''}
                          language={selectedCodeLanguage}
                          theme="vs-dark"
                          options={{
                            fontSize: 14,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                            lineNumbers: 'on',
                            roundedSelection: false,
                            cursorStyle: 'line',
                            automaticLayout: true,
                            wordWrap: 'on',
                            formatOnType: true,
                            formatOnPaste: true,
                            renderLineHighlight: 'all',
                            scrollbar: {
                              vertical: 'visible',
                              horizontal: 'visible',
                              verticalScrollbarSize: 12,
                            }
                          }}
                        />
                      </div>
                    </div>
                  </Panel>

                  <HorizontalResizeHandle />

                  <Panel 
                    defaultSize={40}  // Increased
                    minSize={25}      // Increased minimum size
                    maxSize={75}      // Adjusted maximum size
                  >
                    {/* Test Cases and Results Section */}
                    <div className={`h-full flex flex-col group ${isTestCasesExpanded ? 'fixed inset-0 z-50 bg-[#1a1a1a]' : ''}`}>
                      {/* Tabs */}
                      <div className="border-b border-[#2a2a2a]">
                        <div className="flex items-center justify-between px-4">
                          <div className="flex">
                            <button
                              onClick={() => setActiveTab('testCases')}
                              className={`px-4 py-3 text-sm font-medium transition-colors relative
                                ${activeTab === 'testCases' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                            >
                              Test Cases
                              {activeTab === 'testCases' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                              )}
                            </button>
                            <button
                              onClick={() => setActiveTab('results')}
                              className={`px-4 py-3 text-sm font-medium transition-colors relative
                                ${activeTab === 'results' ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                            >
                              Results
                              {activeTab === 'results' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                              )}
                            </button>
                          </div>
                          
                          {/* Controls - Only show on hover */}
                          <div className="hidden group-hover:flex items-center gap-2">
                            <button 
                              className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                              title={isTestCasesExpanded ? "Exit Fullscreen" : "Fullscreen"}
                              onClick={handleTestCasesExpand}
                            >
                              {isTestCasesExpanded ? (
                                // Collapse icon (shown when expanded)
                                <MdFullscreenExit className="w-6 h-6" />
                              ) : (
                                // Expand icon (shown when collapsed)
                                <MdFullscreen className="w-6 h-6" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'testCases' ? (
                          <div className="space-y-3">
                            {parseExamples(question?.examples).map((example, index) => (
                              <div key={index} className="bg-[#282c34] rounded-lg p-4">
                                <div className="mb-3">
                                  <span className="text-sm font-medium text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded">
                                    Testcase {index + 1}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-sm font-mono">
                                    <span className="text-gray-400">Input: </span>
                                    <span className="text-white">{example.input}</span>
                                  </div>
                                  <div className="text-sm font-mono">
                                    <span className="text-gray-400">Output: </span>
                                    <span className="text-white">{example.output}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-[#282c34] rounded-lg p-4 h-full flex items-center justify-center">
                            <span className="text-gray-400 text-sm">Run your code to see results</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-3">
        <div className="flex justify-end items-center">
          <button className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg cursor-pointer">
            Run
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile Components
const MobileDescription = ({ question, activeLeftTab, handleLeftTabChange, renderContent, selectedSolutionLanguage, availableSolutionLanguages, handleSolutionLanguageChange }) => (
  <div className="h-full flex flex-col bg-[#1a1a1a] overflow-hidden">
    <div className="border-b border-[#2a2a2a] flex flex-col">
      {/* Language selector */}
      {availableSolutionLanguages.length > 1 && (
        <div className="px-2 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
          <span className="text-sm text-gray-400">Language:</span>
          <div className="relative">
            <select
              value={selectedSolutionLanguage}
              onChange={(e) => handleSolutionLanguageChange(e.target.value)}
              className="bg-[#2a2a2a] text-sm rounded px-2 py-1 pr-6 appearance-none"
            >
              {availableSolutionLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {/* Tabs - Horizontally scrollable on mobile */}
      <div className="border-b border-[#2a2a2a] overflow-x-auto hide-scrollbar">
        <div className="flex whitespace-nowrap min-w-max">
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeLeftTab === 0 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
            }`}
            onClick={() => handleLeftTabChange(0)}
          >
            Description
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeLeftTab === 1 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
            }`}
            onClick={() => handleLeftTabChange(1)}
          >
            Brute Force
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeLeftTab === 2 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
            }`}
            onClick={() => handleLeftTabChange(2)}
          >
            Brute Improved
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeLeftTab === 3 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
            }`}
            onClick={() => handleLeftTabChange(3)}
          >
            Improved
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeLeftTab === 4 ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
            }`}
            onClick={() => handleLeftTabChange(4)}
          >
            Optimal
          </button>
        </div>
      </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto px-0">
      {activeLeftTab === 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-medium text-white px-2 py-2">Problem Description</h3>
            <div className="px-2">
              {renderContent(question?.description)}
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium text-white px-2 py-2">Examples</h3>
            <div className="px-2">
              {renderContent(question?.examples)}
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium text-white px-2 py-2">Constraints</h3>
            <div className="px-2">
              {renderContent(formatConstraints(question?.constraints))}
            </div>
          </div>
        </div>
      ) : (
        <div className="prose prose-invert max-w-none px-2">
          {question?.solutions?.[selectedSolutionLanguage] && (() => {
            const solutionKeys = Object.keys(question.solutions[selectedSolutionLanguage]);
            if (solutionKeys.length >= activeLeftTab) {
              const key = solutionKeys[activeLeftTab - 1];
              const solution = question.solutions[selectedSolutionLanguage][key];
              return (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-medium text-white mb-2">Explanation</h4>
                    {renderContent(solution.explanation)}
                  </div>
                  <div>
                    <h4 className="text-base font-medium text-white mb-2">Solution</h4>
                    {renderContent(solution.code)}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  </div>
);


const MobileEditor = ({ userSolutions, activeUserSolution, selectedCodeLanguage, availableCodeLanguages, handleCodeLanguageChange }) => (
  <div className="h-full bg-[#1a1a1a] flex flex-col">
    {/* Language selector for mobile */}
    {availableCodeLanguages.length > 1 && (
      <div className="px-4 py-2 flex items-center gap-2 border-b border-[#2a2a2a]">
        <span className="text-sm text-gray-400">Language:</span>
        <div className="relative">
          <select
            value={selectedCodeLanguage}
            onChange={(e) => handleCodeLanguageChange(e.target.value)}
            className="bg-[#2a2a2a] text-white text-sm rounded-md px-3 py-1 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {availableCodeLanguages.map(lang => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    )}

    <div className="flex-1">
      <Editor
        height="100%"
        value={userSolutions[activeUserSolution]?.code || ''}
        language={selectedCodeLanguage}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  </div>
);
