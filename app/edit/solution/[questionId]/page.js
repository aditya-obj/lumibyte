'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get, update } from 'firebase/database';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';

// Notification component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 ${type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'}`}>
      <div className="flex items-center space-x-3">
        {type === 'error' ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <p className="text-white font-medium">{message}</p>
        <button onClick={onClose} className="text-white hover:text-gray-200">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Helper function to unwrap params
const useUnwrappedParams = (params) => {
  // Use React.use to unwrap the params Promise
  const unwrappedParams = typeof params === 'object' && 'then' in params ? use(params) : params;
  return {
    questionId: unwrappedParams.questionId
  };
};

export default function EditSolution({ params }) {
  const router = useRouter();
  const unwrappedParams = useUnwrappedParams(params);
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

  // Programming language selection - fixed set of languages
  const [availableLanguages] = useState(['python', 'c', 'cpp', 'java']);
  const [selectedLanguage, setSelectedLanguage] = useState('python');

  // Form states
  // Empty code structure with language-specific defaults - all languages are mandatory
  const [emptyCode, setEmptyCode] = useState({
    python: 'def solution():\\n    # Write your code here\\n    pass',
    c: '#include <stdio.h>\\n\\nint main() {\\n    // Write your code here\\n    return 0;\\n}',
    cpp: '#include <iostream>\\n\\nint main() {\\n    // Write your code here\\n    return 0;\\n}',
    java: 'class Solution {\\n    public static void main(String[] args) {\\n        // Write your code here\\n    }\\n}'
  });

  // Solutions organized by language
  const [solutions, setSolutions] = useState({
    python: [{
      language: 'python', // Track language for each solution
      title: '',
      code: 'def solution():\\n    # Write your solution here\\n    pass',
      timeComplexity: '',
      approach: ''
    }]
  });

  // Get default solution template based on language
  const getDefaultSolution = (language) => {
    const templates = {
      python: 'def solution():\\n    # Write your solution here\\n    pass',
      c: '#include <stdio.h>\\n\\nint main() {\\n    // Write your solution here\\n    return 0;\\n}',
      cpp: '#include <iostream>\\n\\nint main() {\\n    // Write your solution here\\n    return 0;\\n}',
      java: 'class Solution {\\n    public static void main(String[] args) {\\n        // Write your code here\\n    }\\n}'
    };
    return {
      language: language, // Include the language property
      title: '',
      code: templates[language] || templates.python,
      timeComplexity: '',
      approach: ''
    };
  };

  // Handle language tab change
  const handleLanguageTabChange = (language) => {
    setSelectedLanguage(language);

    // Initialize solutions for the selected language if they don't exist
    if (!solutions[language]) {
      setSolutions({
        ...solutions,
        [language]: [getDefaultSolution(language)]
      });
    }
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

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        // Check if user is logged in
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUser(user);

            // Fetch the question data
            const questionRef = ref(db, `users/${user.uid}/questions/${unwrappedParams.questionId}`);
            const snapshot = await get(questionRef);

            if (snapshot.exists()) {
              const questionData = snapshot.val();
              setQuestion(questionData);

              // Pre-fill the form with existing data
              if (questionData.empty_code) {
                if (typeof questionData.empty_code === 'string') {
                  // Handle old format (string)
                  setEmptyCode({
                    ...emptyCode,
                    python: questionData.empty_code
                  });
                } else {
                  // Handle new format (object with language keys)
                  setEmptyCode({
                    python: 'def solution():\\n    # Write your code here\\n    pass',
                    c: '#include <stdio.h>\\n\\nint main() {\\n    // Write your code here\\n    return 0;\\n}',
                    cpp: '#include <iostream>\\n\\nint main() {\\n    // Write your code here\\n    return 0;\\n}',
                    java: 'class Solution {\\n    public static void main(String[] args) {\\n        // Write your code here\\n    }\\n}',
                    ...questionData.empty_code
                  });
                }
              }

              // Handle solutions structure
              if (questionData.solutions) {
                if (Array.isArray(questionData.solutions)) {
                  // Handle old format (array of solutions)
                  setSolutions({
                    python: questionData.solutions.map(solution => ({
                      ...solution,
                      language: 'python'
                    }))
                  });
                } else {
                  // Handle new format (object with language keys)
                  setSolutions(questionData.solutions);
                }
              }
            } else {
              router.push('/edit/solutions');
            }
          } else {
            router.push('/login');
          }
        });

        return () => unsubscribe();
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

    fetchQuestion();
  }, [auth, db, router, unwrappedParams.questionId]);

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

    // Validation for empty_code (required)
    const hasEmptyLanguage = Object.values(emptyCode).some(code => !code.trim());
    if (hasEmptyLanguage) {
      setNotification({
        show: true,
        message: 'Starter code is required for all languages',
        type: 'error'
      });
      return;
    }

    // Process solutions by language
    const processedSolutions = {};
    let hasIncompleteSolution = false;

    // First, reorganize solutions by their language property
    const solutionsByLanguage = {};

    // Go through each language tab
    Object.keys(solutions).forEach(langTab => {
      // Go through each solution in this tab
      solutions[langTab].forEach(solution => {
        // Use the solution's language property (which might be different from the tab)
        const lang = solution.language;

        if (!solutionsByLanguage[lang]) {
          solutionsByLanguage[lang] = [];
        }

        solutionsByLanguage[lang].push(solution);
      });
    });

    // Now process the reorganized solutions
    Object.keys(solutionsByLanguage).forEach(language => {
      // Skip languages with no solutions
      if (!solutionsByLanguage[language] || solutionsByLanguage[language].length === 0) return;

      // Check for incomplete solutions
      const hasIncompleteForLang = solutionsByLanguage[language].some(solution =>
        (solution.title || solution.code || solution.timeComplexity) &&
        (!solution.title.trim() || !solution.code.trim() || !solution.timeComplexity.trim())
      );

      if (hasIncompleteForLang) {
        hasIncompleteSolution = true;
      }

      // Add valid solutions to processed solutions
      processedSolutions[language] = solutionsByLanguage[language];
    });

    if (hasIncompleteSolution) {
      setNotification({
        show: true,
        message: 'Please fill all required fields for each solution (title, code, and time complexity) or remove incomplete solutions',
        type: 'error'
      });
      return;
    }

    try {
      const updates = {
        [`users/${user.uid}/questions/${unwrappedParams.questionId}/empty_code`]: emptyCode,
      };

      // Only update solutions if there are any
      if (Object.keys(processedSolutions).length > 0) {
        updates[`users/${user.uid}/questions/${unwrappedParams.questionId}/solutions`] = processedSolutions;
      } else {
        // If no solutions, remove the solutions field from database
        updates[`users/${user.uid}/questions/${unwrappedParams.questionId}/solutions`] = null;
      }

      await update(ref(db), updates);

      setNotification({
        show: true,
        message: 'Solutions updated successfully!',
        type: 'success'
      });

      // Wait a moment for the notification to be seen before redirecting
      setTimeout(() => {
        router.push('/edit/solutions');
      }, 1500);
    } catch (err) {
      setNotification({
        show: true,
        message: 'Failed to update solutions. Please try again.',
        type: 'error'
      });
      console.error('Error updating solutions:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111827]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-[#111827] text-gray-200">
      {/* Show notification if it's active */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">
          Edit Solution: <span className="text-purple-400">{question?.title}</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question Details (Readonly) */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
            <input
              type="text"
              value={question?.title || ''}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                text-gray-100 cursor-not-allowed opacity-70"
              readOnly
            />
          </div>

          {/* Description */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={question?.description || ''}
                className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Examples */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
            <div className="relative">
              <textarea
                value={question?.examples || ''}
                className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
            <div className="relative">
              <textarea
                value={question?.constraints || ''}
                className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 resize-none cursor-not-allowed opacity-70"
                readOnly
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>

          {/* Starter Code Section - All languages are mandatory */}
          <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-300 mb-4">
                Starter Code <span className="text-red-400">*</span>
              </h3>
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
              <div className="h-[250px] rounded-xl overflow-hidden border border-gray-700">
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
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'gutter',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Solutions */}
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

              <div className="space-y-6">
                {(solutions[selectedLanguage] || []).map((solution, index) => (
                  <div key={index} className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-6">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Title <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={solution.title}
                          onChange={(e) => updateSolution(index, 'title', e.target.value)}
                          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                            focus:ring-purple-500/50 focus:border-transparent"
                          placeholder="e.g., Two-Pointer Approach"
                          required
                        />
                      </div>
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
                            focus:ring-purple-500/50 focus:border-transparent"
                          placeholder="e.g., O(n log n)"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Approach (Optional)
                      </label>
                      <div className="relative">
                        <textarea
                          value={solution.approach}
                          onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                          className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                            text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                            focus:ring-purple-500/50 focus:border-transparent resize-none"
                          placeholder="Explain your approach here..."
                        />
                        <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                          Markdown supported
                        </div>
                      </div>
                    </div>

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
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            renderLineHighlight: 'gutter',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={addSolution}
              className="px-6 py-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/50
                hover:bg-purple-500/20 transition-colors"
            >
              Add Solution
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600
                transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Note: Custom scrollbar styles in globals.css are used by the left column and textareas
