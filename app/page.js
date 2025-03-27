'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Login from '@/components/Login';
import { auth, db } from '@/components/firebase.config';
import { ref, get } from 'firebase/database';
import { format } from 'date-fns';

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (user) {
      // Fetch topics
      const topicsRef = ref(db, `users/${user.uid}/topics`);
      get(topicsRef).then((snapshot) => {
        if (snapshot.exists()) {
          const topicsData = Object.values(snapshot.val());
          setTopics(topicsData);
        }
      });

      // Fetch questions with timestamp
      const questionsRef = ref(db, `users/${user.uid}/questions`);
      get(questionsRef).then((snapshot) => {
        if (snapshot.exists()) {
          const questionsData = [];
          snapshot.forEach((childSnapshot) => {
            const question = childSnapshot.val();
            questionsData.push({
              id: childSnapshot.key,
              title: question.title,
              topic: question.topic,
              difficulty: question.difficulty,
              lastRevised: question.lastRevised || null // Add timestamp
            });
          });
          setQuestions(questionsData);
        }
      });
    }
  }, [user]);

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

  const handleRandomize = () => {
    const filteredQuestions = selectedTopics.length > 0
      ? questions.filter(q => selectedTopics.includes(q.topic))
      : questions;
    
    if (filteredQuestions.length > 0) {
      // Sort questions by lastRevised timestamp (null values first, then oldest to newest)
      const sortedQuestions = [...filteredQuestions].sort((a, b) => {
        // If either question has no lastRevised timestamp, prioritize it
        if (!a.lastRevised) return -1;
        if (!b.lastRevised) return 1;
        
        // Otherwise sort by timestamp (oldest first)
        return a.lastRevised - b.lastRevised;
      });

      // Get the questions with the same oldest timestamp
      const oldestTimestamp = sortedQuestions[0].lastRevised;
      const oldestQuestions = sortedQuestions.filter(q => 
        (!oldestTimestamp && !q.lastRevised) || // Both unrevised
        q.lastRevised === oldestTimestamp // Same oldest timestamp
      );

      // Randomly select from the oldest questions
      const randomIndex = Math.floor(Math.random() * oldestQuestions.length);
      setCurrentQuestion(oldestQuestions[randomIndex]);
    } else {
      setCurrentQuestion(null);
    }
  };

  const handleTopicSelect = (topic) => {
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

  return (
    <div className="min-h-screen p-8 transition-colors relative overflow-hidden bg-[#111827]">
      {/* Animated background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-blob"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl transform translate-x-1/2 translate-y-1/2 animate-blob animation-delay-2000"></div>
      </div>

      {/* Login/Logout Button */}
      <div className="absolute top-8 right-8 float">
        {user ? (
          <button 
            onClick={() => auth.signOut()}
            className="glass-button bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl transition-all duration-300 font-medium hover:shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:-translate-y-1"
          >
            Logout
          </button>
        ) : (
          <button 
            onClick={() => setShowLogin(true)}
            className="glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl transition-all duration-300 font-medium hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1"
          >
            Login
          </button>
        )}
      </div>

      <h1 className="text-5xl font-bold mb-12 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient">
        DSA Practice
      </h1>
      
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      <div className="space-y-8">
        {/* Add Question Button at the top */}
        <Link 
          href="/questions"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:-translate-y-1 group"
        >
          <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Questions
        </Link>

        {/* Topic Tags and Selection */}
        <div className="space-y-4">
          {/* Selected Topic Tags */}
          <div className="flex flex-wrap gap-2">
            {selectedTopics.map((topic) => (
              <div 
                key={topic}
                className="bg-gray-800 text-white px-3 py-1 rounded-lg flex items-center gap-2 group hover:bg-gray-700 transition-colors"
              >
                {topic}
                <button
                  onClick={() => handleRemoveTopic(topic)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add Topic Button and Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTopicDropdown(!showTopicDropdown)}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              +
            </button>
            
            {showTopicDropdown && (
              <div className="absolute mt-2 w-64 bg-gray-800 rounded-xl shadow-lg py-2 z-10">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(topic)}
                    className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <span className={`w-4 h-4 rounded border ${
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
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Randomize Button */}
          <button 
            onClick={handleRandomize}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:-translate-y-1 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Randomize Question
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      </div>

      {currentQuestion ? (
        <div className="mt-8 p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg">
          <h2 className="text-2xl font-semibold text-white">
            {currentQuestion.title}
          </h2>
          <div className="flex items-center gap-4 mt-3 text-gray-300 flex-wrap">
            <span>Topic: {currentQuestion.topic}</span>
            <span className={`px-3 py-1 rounded ${
              currentQuestion.difficulty.toLowerCase() === 'easy' 
                ? 'bg-green-500/20 text-green-400' 
                : currentQuestion.difficulty.toLowerCase() === 'medium' 
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {currentQuestion.difficulty}
            </span>
            {currentQuestion.lastRevised && (
              <span className="px-3 py-1 rounded bg-blue-500/20 text-blue-400">
                Last revised: {format(currentQuestion.lastRevised, 'MMM d, yyyy h:mm a')}
              </span>
            )}
          </div>
          <Link 
            href={`/${createSlug(currentQuestion.topic)}/${createSlug(currentQuestion.title)}`}
            className="mt-4 inline-block text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Question →
          </Link>
        </div>
      ) : (
        <div className="mt-8 p-8 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-lg text-center">
          {questions.length === 0 || (selectedTopics.length > 0 && !questions.some(q => selectedTopics.includes(q.topic))) ? (
            // No Questions Available Message
            <>
              <div className="animate-bounce mb-4">
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
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                No Questions under this section
              </h3>
              <p className="text-gray-400 mb-4">
                Try selecting different topics or add new questions
              </p>
              <button
                onClick={handleClearTopics}
                className="text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-2 mx-auto"
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
            </>
          ) : (
            // Initial Message
            <>
              <div className="animate-pulse mb-4">
                <svg 
                  className="w-16 h-16 mx-auto text-blue-500" 
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
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                Ready to Practice?
              </h3>
              <p className="text-gray-400">
                Click on the Randomize Button to get a random question
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
