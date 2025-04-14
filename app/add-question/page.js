'use client';
import { auth, db } from '@/components/firebase.config';
import { get, push, ref, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';

// Configure Monaco loader
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs'
  }
});

export default function QuestionsPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState(['Others']);
  const [questionLink, setQuestionLink] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

  // Initialize Monaco editor with required languages
  useEffect(() => {
    loader.init().then(monaco => {
      ['python', 'cpp', 'java', 'c'].forEach(lang => {
        monaco.languages.register({ id: lang });
      });
    });
  }, []); // Empty dependency array means this runs once when component mounts

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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Fetch both public and user-specific topics
        const publicTopicsRef = ref(db, 'public/topics');
        const userTopicsRef = ref(db, `users/${user.uid}/topics`);

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
      } else {
        setTopics(['Others']);
      }
    });
    return () => unsubscribe();
  }, []);
  const [difficulty, setDifficulty] = useState('Easy');
  // Programming language selection - fixed set of languages
  const [availableLanguages] = useState(['python', 'c', 'cpp', 'java']);
  const [selectedLanguage, setSelectedLanguage] = useState('python');

  // Empty code structure with language-specific defaults - all languages are mandatory
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
  // Removed old error and success states in favor of notification system

  // Get default solution template based on language
  const getDefaultSolution = (language) => {
    const templates = {
      python: 'def solution():\n    # Write your solution here\n    pass',
      c: '#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
      cpp: '#include <iostream>\n\nint main() {\n    // Write your solution here\n    return 0;\n}',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      setNotification({
        show: true,
        message: 'Please login to add questions',
        type: 'error'
      });
      return;
    }

    const finalTopic = showCustomTopic ? customTopic : topic;
    if (!finalTopic) {
      setNotification({
        show: true,
        message: 'Please select or enter a topic.',
        type: 'error'
      });
      return;
    }

    // Add custom topic if needed
    if (showCustomTopic && customTopic) {
      const topicsRef = ref(db, `users/${auth.currentUser.uid}/topics`);
      const topicId = customTopic.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const snapshot = await get(topicsRef);
      const existingTopics = snapshot.val() || {};
      if (!Object.values(existingTopics).includes(customTopic)) {
        const updates = { ...existingTopics };
        updates[topicId] = customTopic;
        await set(topicsRef, updates);
        setTopics(prevTopics => {
          const newTopics = [...prevTopics.filter(t => t !== 'Others'), customTopic, 'Others'].sort((a, b) => {
             if (a === 'Others') return 1;
             if (b === 'Others') return -1;
             return a.localeCompare(b);
          });
          return newTopics;
        });
      }
    }

    try {
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

        // Get default code template for this language
        const defaultTemplate = getDefaultSolution(language).code;

        // Filter out empty solutions for this language
        const validSolutionsForLang = solutionsByLanguage[language].filter(solution =>
          solution.title.trim() ||
          solution.code.trim() !== defaultTemplate ||
          solution.timeComplexity.trim() ||
          solution.approach.trim()
        );

        // Check for incomplete solutions
        const hasIncompleteForLang = validSolutionsForLang.some(solution =>
          (solution.title || solution.code || solution.timeComplexity) &&
          (!solution.title.trim() || !solution.code.trim() || !solution.timeComplexity.trim())
        );

        if (hasIncompleteForLang) {
          hasIncompleteSolution = true;
        }

        // Add valid solutions to processed solutions
        if (validSolutionsForLang.length > 0) {
          processedSolutions[language] = validSolutionsForLang;
        }
      });

      if (hasIncompleteSolution) {
        setNotification({
          show: true,
          message: 'Please complete all required fields (Title, Code, Time Complexity) for each solution or remove incomplete solutions',
          type: 'error'
        });
        return;
      }

      // Create empty_code structure
      const emptyCodeData = {};
      Object.keys(emptyCode).forEach(lang => {
        emptyCodeData[lang] = emptyCode[lang];
      });

      const questionData = {
        title,
        questionLink,
        description,
        examples,
        constraints,
        topic: finalTopic,
        difficulty,
        empty_code: emptyCodeData,
        createdAt: Date.now(),
        userId: auth.currentUser.uid
      };

      // Only add solutions to questionData if there are valid solutions
      if (Object.keys(processedSolutions).length > 0) {
        questionData.solutions = processedSolutions;
      }

      const userQuestionsRef = ref(db, `users/${auth.currentUser.uid}/questions`);
      await push(userQuestionsRef, questionData);

      // Show success notification
      setNotification({
        show: true,
        message: 'Question added successfully!',
        type: 'success'
      });

      // Reset form fields
      setTitle('');
      setDescription('');
      setExamples('');
      setConstraints('');
      setTopic('');
      setCustomTopic('');
      setShowCustomTopic(false);
      setDifficulty('Easy');
      setSelectedLanguage('python');
      // Reset solutions to only have Python with an empty solution
      setSolutions({
        python: [{
          language: 'python',
          title: '',
          code: 'def solution():\n    # Write your solution here\n    pass',
          timeComplexity: '',
          approach: ''
        }]
      });
      setQuestionLink('');

      window.scrollTo(0, 0);

    } catch (err) {
      setNotification({
        show: true,
        message: 'Failed to add question. Please try again.',
        type: 'error'
      });
      console.error('Error adding question:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Show notification if it's active */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
      {/* Header section */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-4 py-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              Add New Question
            </h1>
            <p className="text-gray-400 mt-2 text-sm sm:text-base">
              Create and manage your coding practice questions
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto space-y-6">
        {/* Title & Topic Section */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6 space-y-6">
            {/* Title Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                  font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-gray-400 
                  focus:border-2 transition-all duration-200
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder="Enter a descriptive title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Question Link</label>
              <input
                type="url"
                value={questionLink}
                onChange={(e) => setQuestionLink(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                  font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-gray-400 
                  focus:border-2 transition-all duration-200
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder="Enter question link (e.g., LeetCode, HackerRank)..."
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
                        : 'bg-[#111111] text-gray-400 hover:bg-[#161616] hover:text-gray-300'
                      }
                    `}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Custom Topic Input */}
              {showCustomTopic && (
                <div className="mt-4">
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                      placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                      focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
                    placeholder="Enter custom topic..."
                    required={showCustomTopic}
                  />
                </div>
              )}
            </div>

            {/* Difficulty Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Difficulty</label>
              <div className="grid grid-cols-3 gap-3">
                {['Easy', 'Medium', 'Hard'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`
                      py-3 rounded-xl text-sm font-medium transition-all duration-300
                      ${difficulty === diff
                        ? diff === 'Easy'
                          ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                          : diff === 'Medium'
                          ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50'
                          : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                        : 'bg-[#111111] text-gray-400 hover:bg-[#161616] hover:text-gray-300'
                      }
                    `}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-[250px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none 
                  focus:border-gray-400 focus:border-2 resize-none
                  transition-all duration-200
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder="Enter the problem description..."
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>
        </div>

        {/* Examples Section */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
            <div className="relative">
              <textarea
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                className="w-full h-[200px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none 
                  focus:border-gray-400 focus:border-2 resize-none
                  transition-all duration-200
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder="Input: nums = [1, 2, 3]&#10;Output: [1, 2, 3]&#10;Explanation: Example details..."
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>
        </div>

        {/* Constraints Section */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
            <div className="relative">
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                className="w-full h-[150px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                  text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none 
                  focus:border-gray-400 focus:border-2 resize-none
                  transition-all duration-200
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                placeholder="• 1 <= nums.length <= 10^5&#10;• -10^9 <= nums[i] <= 10^9"
                required
              />
              <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                Markdown supported
              </div>
            </div>
          </div>
        </div>

        {/* Starter Code Section - All languages are mandatory */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-300 mb-4">Starter Code</h3>
            <p className="text-sm text-gray-400 mb-6">Provide starter code for all supported languages</p>

            {/* Tabs for each language */}
            <div className="mb-4 border-b border-gray-700"> {/* Removed bg color */}
              <div className="flex"> {/* Removed bg color */}
                {availableLanguages.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleLanguageTabChange(lang)}
                    className={`px-6 py-2 text-sm font-medium transition-colors relative whitespace-nowrap
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

            {/* Editor container */}
            <div className="rounded-xl overflow-hidden border border-gray-700/50">
              <Editor
                height="300px" // Changed from default height to 300px
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
                  padding: { top: 16, bottom: 16 },
                  automaticLayout: true,
                  theme: {
                    colors: {
                      'editor.background': '#0a0a0a',
                      'editor.lineHighlightBackground': '#111111',
                      'editorGutter.background': '#0a0a0a',
                      'editorLineNumber.foreground': '#444444',
                      'editorLineNumber.activeForeground': '#666666',
                    }
                  }
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

              {/* Language Tabs */}
              <div className="mb-4 border-b border-gray-700">
                <div className="flex">
                  {availableLanguages.map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageTabChange(lang)}
                      className={`px-6 py-2 text-sm font-medium transition-colors relative whitespace-nowrap
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

              {/* Solutions Editor */}
              {(solutions[selectedLanguage] || []).map((solution, index) => (
                <div key={index} className="mb-8 p-6 bg-gray-800/30 rounded-xl">
                  <div className="flex flex-col space-y-4 mb-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-purple-300">Solution {index + 1}</h3>
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

                    {/* Code Editor */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">
                        Code <span className="text-red-400">*</span>
                      </label>
                      <div className="rounded-xl overflow-hidden border border-gray-700/50">
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
                            theme: {
                              colors: {
                                'editor.background': '#0a0a0a',
                                'editor.lineHighlightBackground': '#111111',
                                'editorGutter.background': '#0a0a0a',
                                'editorLineNumber.foreground': '#444444',
                                'editorLineNumber.activeForeground': '#666666',
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="mb-4 w-full flex items-center justify-center gap-2 bg-[#1a1a1a] px-6 py-4 rounded-xl
            text-[#4ecca3] font-medium text-base border border-[#4ecca3]/20
            transition-all duration-200 
            hover:bg-[#222222]
            hover:text-[#5eddb4]
            hover:border-[#4ecca3]/30
            hover:shadow-[0_0_10px_rgba(78,204,163,0.1)]
            focus:outline-none 
            group"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>Add New Question</span>
        </button>

        {/* Notifications are now shown at the top of the page */}
      </form>
    </div>
  );
}
