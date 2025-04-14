'use client';
import { auth, db } from '@/components/firebase.config';
import Editor, { loader } from '@monaco-editor/react';
import { get, push, ref, set, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminQuestionsPage() {
  useEffect(() => {
    // Configure Monaco loader with all required languages
    loader.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs'
      },
      'vs/nls': {
        availableLanguages: {
          '*': 'de'
        }
      }
    });

    // Ensure languages are loaded
    loader.init().then(monaco => {
      // Register additional language features if needed
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

  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState(['Others']);
  const [difficulty, setDifficulty] = useState('Easy');
  const [questionLink, setQuestionLink] = useState('');
  const [existingQuestions, setExistingQuestions] = useState([]);
  

  // Notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

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
      language: 'python',
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]
  });

  // Add isEdit state
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);

  // Add these configurations for Monaco Editor
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 },
    automaticLayout: true,
    wordWrap: 'on',
    lineNumbers: 'on',
    renderLineHighlight: 'gutter',
    formatOnPaste: true,
    formatOnType: true,
    semanticHighlighting: true,
    bracketPairColorization: {
      enabled: true
    },
    'semanticTokenColorCustomizations': {
      enabled: true
    }
  };

  useEffect(() => {
    // Check URL parameters for edit mode
    const params = new URLSearchParams(window.location.search);
    const isEditMode = params.get('edit') === 'true';
    const questionId = params.get('id');

    if (isEditMode && questionId) {
      setIsEdit(true);
      setEditId(questionId);
      loadQuestionData(questionId);
    }
  }, []);

  const loadQuestionData = async (questionId) => {
    try {
      const questionRef = ref(db, `public/questions/${questionId}`);
      const snapshot = await get(questionRef);
      
      if (snapshot.exists()) {
        const questionData = snapshot.val();
        
        // Populate form fields with existing data
        setTitle(questionData.title || '');
        setDescription(questionData.description || '');
        setExamples(questionData.examples || '');
        setConstraints(questionData.constraints || '');
        setTopic(questionData.topic || '');
        setDifficulty(questionData.difficulty || 'Easy');
        setQuestionLink(questionData.questionLink || '');
        
        // Handle empty code
        if (questionData.empty_code) {
          setEmptyCode(questionData.empty_code);
        }

        // Handle solutions
        if (questionData.solutions) {
          setSolutions(questionData.solutions);
        }

        // Handle custom topic
        if (!topics.includes(questionData.topic)) {
          setShowCustomTopic(true);
          setCustomTopic(questionData.topic);
        }
      }
    } catch (error) {
      console.error('Error loading question:', error);
      setNotification({
        show: true,
        message: 'Error loading question data',
        type: 'error'
      });
    }
  };

  // Check if user is admin
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || user.uid !== process.env.NEXT_PUBLIC_USER_UID) {
        window.location.href = '/'; // Redirect non-admin users
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch public topics
  useEffect(() => {
    const topicsRef = ref(db, 'public/topics');
    get(topicsRef).then((snapshot) => {
      if (snapshot.exists()) {
        const topicsData = Object.values(snapshot.val());
        setTopics([...topicsData, 'Others']);
      } else {
        setTopics(['Others']);
      }
    });
  }, []);

  // Load existing questions on component mount
  useEffect(() => {
    const fetchExistingQuestions = async () => {
      try {
        const questionsRef = ref(db, 'public/questions');
        const snapshot = await get(questionsRef);
        if (snapshot.exists()) {
          const questions = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          setExistingQuestions(questions);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        setNotification({
          show: true,
          message: 'Error fetching existing questions',
          type: 'error'
        });
      }
    };

    fetchExistingQuestions();
  }, []);

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
    if (!currentLangSolutions[index]) {
      currentLangSolutions[index] = getDefaultSolution(selectedLanguage);
    }
    currentLangSolutions[index][field] = value;
    setSolutions({
      ...solutions,
      [selectedLanguage]: currentLangSolutions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser || auth.currentUser.uid !== process.env.NEXT_PUBLIC_USER_UID) {
      setNotification({
        show: true,
        message: 'Unauthorized access',
        type: 'error'
      });
      return;
    }

    try {
      const questionData = {
        title,
        description,
        examples,
        constraints,
        topic: showCustomTopic ? customTopic : topic,
        difficulty,
        empty_code: emptyCode,
        solutions,
        updatedAt: Date.now(),
        questionLink
      };

      if (isEdit && editId) {
        // Update existing question
        await update(ref(db, `public/questions/${editId}`), questionData);
        setNotification({
          show: true,
          message: 'Question updated successfully!',
          type: 'success'
        });
      } else {
        // Create new question
        questionData.createdAt = Date.now();
        const questionsRef = ref(db, 'public/questions');
        await push(questionsRef, questionData);
        setNotification({
          show: true,
          message: 'Question added successfully!',
          type: 'success'
        });
      }

      // Redirect after success
      setTimeout(() => {
        router.push('/admin');
      }, 1500);

    } catch (error) {
      console.error('Error saving question:', error);
      setNotification({
        show: true,
        message: isEdit ? 'Error updating question' : 'Error creating question',
        type: 'error'
      });
    }
  };

  // Update page title based on mode
  const pageTitle = isEdit ? 'Edit Question' : 'Create New Question';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            {pageTitle}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-400">
            {isEdit ? 'Edit an existing coding challenge' : 'Add a new coding challenge to the public question bank'}
          </p>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[2fr,1fr] gap-6">
          {/* Left Column - Main Content */}
          <div className="space-y-6">
            {/* Title & Topic Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
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
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-[300px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
                    placeholder="Write your question description using Markdown..."
                    required
                  />
                  <div className="absolute right-3 bottom-3 px-2 py-1 bg-gray-900/50 rounded-md text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-6">
            {/* Examples Section */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
                <div className="relative">
                  <textarea
                    value={examples}
                    onChange={(e) => setExamples(e.target.value)}
                    className="w-full h-[200px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
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
                    className="w-full h-[150px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2
                      focus:ring-purple-500/50 focus:border-transparent resize-none
                      transition-all duration-200 hover:bg-gray-900/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
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
                    options={editorOptions}
                    beforeMount={(monaco) => {
                      // Configure language features
                      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: false,
                        noSyntaxValidation: false,
                      });
                      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                        target: monaco.languages.typescript.ScriptTarget.Latest,
                        allowNonTsExtensions: true,
                      });
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
                            defaultLanguage={(solution?.language || selectedLanguage || 'python').toLowerCase()}
                            value={solution?.code || ''}
                            onChange={(value) => updateSolution(index, 'code', value)}
                            theme="vs-dark"
                            options={editorOptions}
                            beforeMount={(monaco) => {
                              // Configure language features for each language
                              const lang = (solution?.language || selectedLanguage || 'python').toLowerCase();
                              if (lang === 'python') {
                                monaco.languages.python?.setDefaults({
                                  validate: true,
                                  format: true
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Button */}
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
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600
                  text-white font-medium rounded-xl shadow-lg hover:shadow-xl
                  transition-all duration-300 transform hover:-translate-y-1
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                {isEdit ? 'Update Question' : 'Create Question'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
