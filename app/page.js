'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Login from '@/components/Login';
import { auth, db } from '@/components/firebase.config';
import { ref, get } from 'firebase/database';

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

      // Fetch questions
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
              difficulty: question.difficulty
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
      const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
      setCurrentQuestion(filteredQuestions[randomIndex]);
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
    <div className="min-h-screen p-8 transition-colors relative">
      <div className="absolute top-8 right-8">
        {user ? (
          <button 
            onClick={() => auth.signOut()}
            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Logout
          </button>
        ) : (
          <button 
            onClick={() => setShowLogin(true)}
            className="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Login
          </button>
        )}
      </div>

      <h1 className="text-4xl font-bold mb-12 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        DSA Practice
      </h1>
      
      {showLogin && <Login onClose={() => setShowLogin(false)} />}

      <div className="space-y-4">
        <div className="flex gap-4">
          <button 
            onClick={handleRandomize}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Randomize Question
          </button>

          <Link 
            href="/questions"
            className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Add Questions
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTopicDropdown(!showTopicDropdown)}
              className="bg-accent hover:bg-accent-hover text-white p-2 rounded-lg transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            {showTopicDropdown && (
              <div className="absolute z-10 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu">
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleTopicSelect(topic)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      role="menuitem"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedTopics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-white text-sm"
            >
              {topic}
              <button
                onClick={() => handleRemoveTopic(topic)}
                className="hover:text-red-300"
              >
                ×
              </button>
            </span>
          ))}

          {selectedTopics.length > 0 && (
            <button
              onClick={handleClearTopics}
              className="text-sm text-gray-500 hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {currentQuestion && (
        <div className="mt-8 p-6 rounded-xl bg-code-bg shadow-sm">
          <h2 className="text-2xl font-semibold">
            {currentQuestion.title}
          </h2>
          <div className="flex items-center gap-4 mt-3 text-secondary">
            <span>Topic: {currentQuestion.topic}</span>
            <span className={`px-3 py-1 rounded ${currentQuestion.difficulty.toLowerCase() === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : currentQuestion.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
              {currentQuestion.difficulty}
            </span>
          </div>
          <Link 
            href={`/${createSlug(currentQuestion.topic)}/${createSlug(currentQuestion.title)}`}
            className="mt-6 inline-block bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg transition-colors shadow-sm"
          >
            Go to Question
          </Link>
        </div>
      )}
    </div>
  );
}
