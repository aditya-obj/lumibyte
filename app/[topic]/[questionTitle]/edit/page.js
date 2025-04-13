'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { get, ref, update } from 'firebase/database';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import React from 'react';
import { HashLoader } from 'react-spinners';
import Breadcrumbs from '@/components/Breadcrumbs';

// Notification component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`}>
      {message}
    </div>
  );
};

function EditQuestionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = searchParams.get('id');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [questionLink, setQuestionLink] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });
  const [topics, setTopics] = useState(['Others']);
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');

  // Programming language selection - fixed set of languages
  const [availableLanguages] = useState(['python', 'c', 'cpp', 'java']);
  const [selectedLanguage, setSelectedLanguage] = useState('python');

  // Empty code structure with language-specific defaults
  const [emptyCode, setEmptyCode] = useState({
    python: 'def solution():\n    # Write your code here\n    pass',
    c: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
    cpp: '#include <iostream>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
    java: 'class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}'
  });

  // Solutions organized by language
  const [solutions, setSolutions] = useState({
    python: [{
      language: 'python', // Track language for each solution
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]
  });

  // Get default solution template based on language
  const getDefaultSolution = (language) => {
    const templates = {
      python: 'def solution():\n    # Write your solution here\n    pass',
      c: '#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
      cpp: '#include <iostream>\n\nint main() {\n    // Write your code here\n    return 0;\n}',
      java: 'class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}'
    };
    return {
      language: language, // Include the language property
      title: '',
      code: templates[language] || templates.python,
      timeComplexity: '',
      approach: ''
    };
  };

  // Add a solution for the current language
  const addSolution = () => {
    // Get solutions for the current language
    const currentLangSolutions = solutions[selectedLanguage] || [];

    // Check if the last solution has required fields filled
    const canAddSolution = currentLangSolutions.length === 0 ||
      (currentLangSolutions[currentLangSolutions.length - 1].title.trim() &&
       currentLangSolutions[currentLangSolutions.length - 1].timeComplexity.trim());

    if (!canAddSolution) {
      // Show notification instead of setting error
      setNotification({
        show: true,
        message: 'Please complete the required fields (Title, Time Complexity) in the current solution before adding a new one.',
        type: 'error'
      });
      return;
    }

    // Add a new solution with the current language
    setSolutions({
      ...solutions,
      [selectedLanguage]: [...currentLangSolutions, getDefaultSolution(selectedLanguage)]
    });
  };

  // Remove a solution for the current language
  const removeSolution = (index) => {
    const currentLangSolutions = [...(solutions[selectedLanguage] || [])];
    const newSolutions = currentLangSolutions.filter((_, i) => i !== index);

    setSolutions({
      ...solutions,
      [selectedLanguage]: newSolutions.length > 0 ? newSolutions : [getDefaultSolution(selectedLanguage)]
    });
  };

  // Update a solution for the current language
  const updateSolution = (index, field, value) => {
    const currentLangSolutions = [...(solutions[selectedLanguage] || [])];
    if (currentLangSolutions[index]) {
      currentLangSolutions[index][field] = value;
      setSolutions({
        ...solutions,
        [selectedLanguage]: currentLangSolutions
      });
    }
  };

  // Handle language tab change
  const handleLanguageTabChange = (language) => {
    setSelectedLanguage(language);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      setNotification({
        show: true,
        message: 'Please login to update questions',
        type: 'error'
      });
      return;
    }

    if (!title || !description || !topic) {
      setNotification({
        show: true,
        message: 'Title, description, and topic are required',
        type: 'error'
      });
      return;
    }

    try {
      const finalTopic = showCustomTopic ? customTopic : topic;
      const questionData = {
        title,
        description,
        examples,
        constraints,
        topic: finalTopic,
        difficulty,
        questionLink,
        updatedAt: new Date().toISOString()
      };

      const questionRef = ref(db, `users/${auth.currentUser.uid}/questions/${questionId}`);
      await update(questionRef, questionData);

      setNotification({
        show: true,
        message: 'Question updated successfully!',
        type: 'success'
      });

      // Wait a moment for the notification to be seen before going back
      setTimeout(() => {
        router.back(); // This will return to the previous route
      }, 1500);
    } catch (error) {
      console.error('Error updating question:', error);
      setNotification({
        show: true,
        message: 'Failed to update question. Please try again.',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    console.log('Question ID:', questionId);

    const fetchQuestion = async (currentUser) => {
      if (!currentUser || !questionId) {
        console.log('Missing user or question ID');
        return;
      }

      try {
        console.log('Fetching question data...');
        const questionRef = ref(db, `users/${currentUser.uid}/questions/${questionId}`);
        const snapshot = await get(questionRef);
        
        if (snapshot.exists()) {
          console.log('Question data found:', snapshot.val());
          const questionData = snapshot.val();
          
          // Set all the question data
          setTitle(questionData.title || '');
          setDescription(questionData.description || '');
          setExamples(questionData.examples || '');
          setConstraints(questionData.constraints || '');
          setTopic(questionData.topic || '');
          setDifficulty(questionData.difficulty || 'Easy');
          setQuestionLink(questionData.questionLink || ''); // Make sure this is set

          // Fetch topics from public/topics
          const topicsRef = ref(db, 'public/topics');
          const topicsSnapshot = await get(topicsRef);
          if (topicsSnapshot.exists()) {
            const publicTopics = Object.values(topicsSnapshot.val());
            // If the question's topic isn't in the public topics, show custom topic
            if (!publicTopics.includes(questionData.topic)) {
              setShowCustomTopic(true);
              setCustomTopic(questionData.topic);
            }
            setTopics([...publicTopics, 'Others']);
          }

          // Handle solutions structure
          if (questionData.solutions) {
            if (Array.isArray(questionData.solutions)) {
              setSolutions({
                python: questionData.solutions.map(solution => ({
                  ...solution,
                  language: 'python'
                }))
              });
            } else {
              setSolutions(questionData.solutions);
            }
          }

          // Handle empty code if it exists
          if (questionData.empty_code) {
            setEmptyCode(questionData.empty_code);
          }

        } else {
          console.log('Question not found');
          setNotification({
            show: true,
            message: 'Question not found',
            type: 'error'
          });
          router.push('/');
        }
      } catch (error) {
        console.error('Error fetching question:', error);
        setNotification({
          show: true,
          message: 'Failed to load question data',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      console.log('Auth state changed:', currentUser?.uid);
      setUser(currentUser);
      if (currentUser) {
        fetchQuestion(currentUser);
      } else {
        setIsLoading(false);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [questionId, router]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const publicTopicsRef = ref(db, 'public/topics');
    const userTopicsRef = ref(db, `users/${auth.currentUser.uid}/topics`);

    Promise.all([
      get(publicTopicsRef),
      get(userTopicsRef)
    ]).then(([publicSnapshot, userSnapshot]) => {
      const publicTopics = publicSnapshot.exists() ? Object.values(publicSnapshot.val()) : [];
      const userTopics = userSnapshot.exists() ? Object.values(userSnapshot.val()) : [];

      // Merge topics and remove duplicates
      const allTopics = [...new Set([...publicTopics, ...userTopics, 'Others'])].sort((a, b) => {
        if (a === 'Others') return 1; // Keep 'Others' at the end
        if (b === 'Others') return -1;
        return a.localeCompare(b); // Sort alphabetically
      });
      setTopics(allTopics);
    }).catch(error => {
      console.error("Error fetching topics:", error);
      setTopics(['Others']);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex flex-col justify-center items-center bg-[#0a0a0a]">
        <HashLoader color="#9333ea" size={50} />
        <p className="mt-4 text-sm text-gray-400">Loading question editor...</p>
        <p className="mt-2 text-xs text-gray-500">Question ID: {questionId}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <Breadcrumbs />
      
      {/* Show notification if it's active */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title & Topic Section */}
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
            <div className="p-6 space-y-6">
              {/* Title Input */}
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                    placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                    focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
                  placeholder="Enter a descriptive title..."
                  required
                />
              </div>

              {/* Question Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Question Link</label>
                <input
                  type="url"
                  value={questionLink}
                  onChange={(e) => setQuestionLink(e.target.value)}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                    placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                    focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
                  placeholder="Enter the question link (e.g., LeetCode, HackerRank)..."
                />
              </div>

              {/* Topic Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Topic</label>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTopic(t);
                        setShowCustomTopic(t === 'Others');
                      }}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                        ${topic === t
                          ? 'bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                        }
                      `}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {showCustomTopic && (
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="mt-4 w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                      focus:ring-purple-500/50 transition-all duration-200 hover:bg-gray-900/70"
                    placeholder="Enter custom topic..."
                  />
                )}
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Difficulty</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Easy', 'Medium', 'Hard'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`
                        py-3 rounded-xl text-sm font-medium transition-all duration-300
                        ${difficulty === d
                          ? d === 'Easy'
                            ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                            : d === 'Medium'
                            ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50'
                            : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                          : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
                        }
                      `}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-[250px] bg-[#111827] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-[#1a2438]
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter question description (markdown supported)..."
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Examples Section */}
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
            <div className="relative">
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                className="w-full h-[200px] bg-[#111827] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-[#1a2438]
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter examples..."
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Constraints Section */}
          <div className="bg-gray-900/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
            <div className="relative">
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                className="w-full h-[200px] bg-[#111827] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-[#1a2438]
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                placeholder="Enter constraints..."
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Starter Code Section - All languages are mandatory */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-300 mb-4">Starter Code</h3>
              <p className="text-sm text-gray-400 mb-6">Provide starter code for all supported languages</p>

              {/* Tabs for each language */}
              <div className="mb-4 border-b border-gray-700">
                <div className="flex overflow-x-auto">
                  {availableLanguages.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageTabChange(lang)}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap
                        ${selectedLanguage === lang ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      {selectedLanguage === lang && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor for the selected language */}
              <div className="h-[200px] rounded-xl overflow-hidden border border-gray-700">
                <Editor
                  height="100%"
                  defaultLanguage={selectedLanguage}
                  value={emptyCode[selectedLanguage]}
                  onChange={(value) => {
                    setEmptyCode({
                      ...emptyCode,
                      [selectedLanguage]: value
                    });
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    padding: { top: 10, bottom: 10 },
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Solutions Section */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-300">
                    Solutions (Optional)
                  </h3>

                  <button
                    type="button"
                    onClick={addSolution}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-300
                      rounded-xl transition-all duration-300 hover:bg-purple-500/30"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Solution
                  </button>
                </div>

                {/* Tabs for each language */}
                <div className="mb-4 border-b border-gray-700">
                  <div className="flex overflow-x-auto">
                    {availableLanguages.map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageTabChange(lang)}
                        className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap
                          ${selectedLanguage === lang ? 'text-white' : 'text-gray-400 hover:text-gray-300'}`}
                      >
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                        {selectedLanguage === lang && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(solutions[selectedLanguage] || []).map((solution, index) => (
                <div key={index} className="p-6 bg-gray-800/30 rounded-xl border border-gray-700/50">
                  <div className="flex flex-col space-y-4 mb-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-purple-300">Solution {index + 1}</h3>
                      {/* Show remove button only if there's more than one solution */}
                      {(solutions[selectedLanguage] || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSolution(index)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Language selector for this specific solution */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-400">Language:</label>
                      <select
                        value={solution.language}
                        onChange={(e) => updateSolution(index, 'language', e.target.value)}
                        className="bg-gray-800/50 text-white text-sm rounded-md px-3 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500 border border-gray-700"
                      >
                        {availableLanguages.map(lang => (
                          <option key={lang} value={lang}>
                            {lang.charAt(0).toUpperCase() + lang.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Solution Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Solution Title <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={solution.title}
                        onChange={(e) => updateSolution(index, 'title', e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                          focus:ring-purple-500/50 transition-all duration-200"
                        placeholder="e.g., Two Pointer Approach"
                        required={!!(solution.code || solution.timeComplexity)}
                      />
                    </div>

                    {/* Time Complexity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Time Complexity <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={solution.timeComplexity}
                        onChange={(e) => updateSolution(index, 'timeComplexity', e.target.value)}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                          text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                          focus:ring-purple-500/50 transition-all duration-200"
                        placeholder="e.g., O(n log n)"
                        required={!!(solution.title || solution.code)}
                      />
                    </div>

                    {/* Approach */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Approach (Optional)
                      </label>
                      <div className="relative">
                        <textarea
                          value={solution.approach}
                          onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                          className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                            focus:ring-purple-500/50 focus:border-transparent resize-none
                            transition-all duration-200 hover:bg-gray-900/70
                            hover:border-gray-600 backdrop-blur-sm
                            shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                            hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                          placeholder="Explain your approach (markdown supported)..."
                        />
                        <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                          Markdown supported
                        </div>
                      </div>
                    </div>

                    {/* Solution Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Code <span className="text-red-400">*</span>
                      </label>
                      <div className="rounded-xl overflow-hidden border border-gray-700">
                        <Editor
                          height="300px"
                          defaultLanguage={solution.language}
                          value={solution.code}
                          onChange={(value) => updateSolution(index, 'code', value)}
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-xl
              font-medium hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300
              hover:-translate-y-0.5"
          >
            Update Question
          </button>
        </form>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function EditQuestionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-8 flex flex-col justify-center items-center bg-[#0a0a0a]">
        <HashLoader color="#9333ea" size={50} />
        <p className="mt-4 text-sm text-gray-400">Preparing editor...</p>
      </div>
    }>
      <EditQuestionContent />
    </Suspense>
  );
}
