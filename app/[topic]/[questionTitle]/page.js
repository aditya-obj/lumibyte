'use client';
import { useState, useEffect } from 'react';
import React from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';

import { auth, db } from '@/components/firebase.config';
import { ref, get, update } from 'firebase/database';
import { format } from 'date-fns';

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

export default function QuestionPage({ params }) {
  const unwrappedParams = React.use(params);
  const [showSolution, setShowSolution] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [question, setQuestion] = useState(null);
  const [userSolutions, setUserSolutions] = useState([{ code: '', timeComplexity: '' }]);
  const [activeUserSolution, setActiveUserSolution] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const [revealedSolutions, setRevealedSolutions] = useState(new Set());
  const [isRevising, setIsRevising] = useState(false);

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
      const questionRef = ref(db, `users/${user.uid}/questions/${question.id}`);
      
      await update(questionRef, {
        lastRevised: timestamp
      });

      // Update local state
      setQuestion(prev => ({
        ...prev,
        lastRevised: timestamp
      }));
    } catch (error) {
      console.error('Error updating revision timestamp:', error);
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
      setUserSolutions([{ code: question.empty_code, timeComplexity: '' }]);
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
      if (user && unwrappedParams) {
        const questionsRef = ref(db, `users/${user.uid}/questions`);
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
        }
      }
      setLoading(false);
    };

    fetchQuestion();
  }, [user, unwrappedParams]);

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>;
  }

  if (!question) {
    return <div className="min-h-screen p-8">Question not found</div>;
  }

  return (
    <div className="min-h-screen p-8 transition-colors relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-48 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-0 -right-48 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      {/* Header section with title and revised button */}
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient">
          {question?.title}
        </h1>

        <button
          onClick={handleRevision}
          disabled={isRevising}
          className={`
            glass-button bg-gradient-to-r from-emerald-500 to-green-500 
            text-white px-6 py-2.5 rounded-xl transition-all duration-300 
            hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:-translate-y-1
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center gap-2 text-sm
          `}
        >
          {isRevising ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark as Revised</span>
            </>
          )}
        </button>
      </div>
      
      {/* Topic, Difficulty, and Last Revised badges */}
      <div className="flex gap-4 mb-8 items-center flex-wrap">
        <span className="glass-container px-4 py-2 rounded-full text-sm font-medium">
          {question?.topic}
        </span>
        <span className={`
          glass-container px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105
          ${question?.difficulty.toLowerCase() === 'easy' 
            ? 'bg-green-500/10 text-green-400' 
            : question?.difficulty.toLowerCase() === 'medium'
            ? 'bg-yellow-500/10 text-yellow-400'
            : 'bg-red-500/10 text-red-400'}
        `}>
          {question?.difficulty}
        </span>
        {question?.lastRevised && (
          <span className="glass-container px-4 py-2 rounded-full text-sm font-medium text-blue-400">
            Last revised: {formatDate(question.lastRevised)}
          </span>
        )}
      </div>

      {/* Question content in a glass container */}
      <div className="glass-container rounded-xl p-8 mb-8 backdrop-blur-lg">
        <div className="prose prose-invert max-w-none">
          <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl font-semibold mb-2">Description</h2>
            <div dangerouslySetInnerHTML={{ __html: marked(question?.description || '') }} />
          </div>

          <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-xl font-semibold mb-2">Examples</h2>
            <div dangerouslySetInnerHTML={{ __html: marked(question?.examples || '') }} />
          </div>

          <div className="mb-6 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-xl font-semibold mb-2">Constraints</h2>
            <div dangerouslySetInnerHTML={{ __html: marked(question?.constraints || '') }} />
          </div>
        </div>
      </div>

      {/* Solution toggle button - only show on mobile */}
      <button 
        onClick={() => setShowSolution(!showSolution)}
        className="glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1 mb-8 lg:hidden"
      >
        {showSolution ? 'Hide Solution' : 'Show Solution'}
      </button>

      {/* Two-column layout for code sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Your Solutions Section */}
        <div className="glass-container rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Your Solutions
            </h2>
            <button
              onClick={() => setUserSolutions([...userSolutions, { code: question?.empty_code, timeComplexity: '' }])}
              className="glass-button bg-gradient-to-r from-green-400 to-emerald-500 text-white w-8 h-8 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:-translate-y-1 flex items-center justify-center text-xl"
            >
              +
            </button>
          </div>

          {/* Solution tabs */}
          <div className="flex border-b border-gray-700/50 mb-4 overflow-x-auto">
            {userSolutions.map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-4 py-2 font-medium whitespace-nowrap relative group"
              >
                <span
                  onClick={() => setActiveUserSolution(index)}
                  className={`cursor-pointer transition-all duration-300 ${
                    activeUserSolution === index 
                      ? 'text-primary border-b-2 border-primary scale-105' 
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Solution {index + 1}
                </span>
                {userSolutions.length > 1 && (
                  <button
                    onClick={() => {
                      const newSolutions = userSolutions.filter((_, i) => i !== index);
                      setUserSolutions(newSolutions);
                      if (activeUserSolution >= newSolutions.length) {
                        setActiveUserSolution(newSolutions.length - 1);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all duration-300"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Code editor */}
          <div className="h-[500px] rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Editor
              height="100%"
              defaultValue={userSolutions[activeUserSolution].code}
              language="python"
              theme="vs-dark"
              onChange={(value) => {
                const newSolutions = [...userSolutions];
                newSolutions[activeUserSolution].code = value;
                setUserSolutions(newSolutions);
              }}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                roundedSelection: false,
                padding: { top: 16, bottom: 16 },
                cursorBlinking: "smooth",
              }}
            />
          </div>
        </div>

        {/* Show Solutions Button - show when Solutions div is hidden */}
        {!showSolutions && (
          <div className="flex items-start justify-center">
            <button 
              onClick={() => setShowSolutions(true)}
              className="glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1"
            >
              Show Solutions
            </button>
          </div>
        )}

        {/* Solutions Section - show when showSolutions is true */}
        {showSolutions && (
          <div className="glass-container rounded-xl p-6 animate-fadeInUp">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Solutions
              </h2>
              <button 
                onClick={() => setShowSolutions(false)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Solution Tabs */}
            <div className="flex border-b border-gray-700/50 mb-6 overflow-x-auto">
              {question.solutions.map((solution, index) => (
                <button
                  key={index}
                  onClick={() => handleTabChange(index)}
                  className={`px-4 py-2 font-medium whitespace-nowrap transition-all duration-300 ${
                    activeTab === index
                      ? 'text-primary border-b-2 border-primary scale-105'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {solution.title || `Solution ${index + 1}`}
                </button>
              ))}
            </div>

            {/* Active Solution Content */}
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
                  {question.solutions[activeTab].timeComplexity}
                </span>
              </div>

              {/* Solution Approach */}
              {question.solutions[activeTab].approach && (
                <div className="prose prose-invert max-w-none">
                  <h4 className="text-lg font-medium mb-2">Approach</h4>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    {question.solutions[activeTab].approach}
                  </div>
                </div>
              )}

              {/* Solution Code */}
              <div>
                <h4 className="text-lg font-medium mb-2">Implementation</h4>
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => !revealedSolutions.has(activeTab) && handleRevealSolution(activeTab)}
                >
                  {/* Blur Overlay */}
                  {!revealedSolutions.has(activeTab) && (
                    <div className="blur-overlay absolute inset-0 bg-gray-900/10 backdrop-blur-md z-10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:backdrop-blur-sm">
                      <span className="text-gray-300 font-medium">Click to reveal solution</span>
                    </div>
                  )}

                  {/* Code Editor */}
                  <div className="h-[400px] rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                    <Editor
                      height="100%"
                      value={question.solutions[activeTab].code}
                      language="python"
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        padding: { top: 16, bottom: 16 },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Revised button at the bottom */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleRevision}
          disabled={isRevising}
          className={`
            glass-button bg-gradient-to-r from-emerald-500 to-green-500 
            text-white px-8 py-3 rounded-xl transition-all duration-300 
            hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:-translate-y-1
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center gap-2
          `}
        >
          {isRevising ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Updating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mark as Revised</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
