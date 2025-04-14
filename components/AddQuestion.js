'use client';
import { auth, db } from '@/components/firebase.config';
import Editor, { loader } from '@monaco-editor/react';
import { get, push, ref, set, update } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AddQuestion({ location }) { // Add location prop
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

  // Function to check if question exists
  const checkQuestionExists = async (title) => {
    try {
      const questionsRef = ref(db, `${location}/questions`);
      const snapshot = await get(questionsRef);
      
      if (snapshot.exists()) {
        const questions = Object.values(snapshot.val());
        return questions.some(q => q.title.toLowerCase() === title.toLowerCase());
      }
      return false;
    } catch (error) {
      console.error('Error checking question existence:', error);
      return false;
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

    try {
      // Check if question already exists
      const questionExists = await checkQuestionExists(title);
      if (questionExists) {
        setNotification({
          show: true,
          message: 'A question with this title already exists.',
          type: 'error'
        });
        return;
      }

      // Process solutions
      const processedSolutions = {};
      let hasIncompleteSolution = false;

      Object.entries(solutions).forEach(([language, solutionsForLang]) => {
        const validSolutionsForLang = solutionsForLang.filter(solution =>
          solution.title.trim() || solution.code.trim() || solution.timeComplexity.trim()
        );

        // Check for incomplete solutions
        const hasIncompleteForLang = validSolutionsForLang.some(solution =>
          (solution.title || solution.code || solution.timeComplexity) &&
          (!solution.title.trim() || !solution.code.trim() || !solution.timeComplexity.trim())
        );

        if (hasIncompleteForLang) {
          hasIncompleteSolution = true;
        }

        if (validSolutionsForLang.length > 0) {
          processedSolutions[language] = validSolutionsForLang;
        }
      });

      if (hasIncompleteSolution) {
        setNotification({
          show: true,
          message: 'Please complete all required fields for each solution or remove incomplete solutions',
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

      // Only add solutions if there are valid ones
      if (Object.keys(processedSolutions).length > 0) {
        questionData.solutions = processedSolutions;
      }

      const questionsRef = ref(db, `${location}/questions`);
      await push(questionsRef, questionData);

      setNotification({
        show: true,
        message: 'Question added successfully!',
        type: 'success'
      });

      // Reset form
      setTitle('');
      setDescription('');
      setExamples('');
      setConstraints('');
      setTopic('');
      setCustomTopic('');
      setShowCustomTopic(false);
      setDifficulty('Easy');
      setSelectedLanguage('python');
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
    } catch (error) {
      setNotification({
        show: true,
        message: 'Error adding question: ' + error.message,
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
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl">
              <div className="p-6 space-y-6">
                {/* Title Input */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Question Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                      placeholder-gray-500 focus:outline-none focus:ring-[1px] focus:ring-white/30
                      focus:border-white/30 transition-all duration-200 hover:bg-[#0a0a0a]/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
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
                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 text-gray-100
                      placeholder-gray-500 focus:outline-none focus:ring-[1px] focus:ring-white/30
                      focus:border-white/30 transition-all duration-200 hover:bg-[#0a0a0a]/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                    placeholder="Enter the question link (e.g., LeetCode, HackerRank)..."
                  />
                </div>

                {/* Topic Selection */}
                <div className="bg-[#0a0a0a]/40 backdrop-blur-xl rounded-2xl border border-gray-800/50">
                  <div className="p-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Topic</label>
                    <div className="flex flex-wrap gap-2">
                      {topics.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (t === 'Others') {
                              setShowCustomTopic(true);
                              setTopic('');
                            } else {
                              setShowCustomTopic(false);
                              setTopic(t === topic ? '' : t); // Toggle selection
                            }
                          }}
                          className={`
                            px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${topic === t
                              ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30'
                              : 'bg-gray-800/50 text-gray-400 hover:text-purple-300 hover:bg-gray-800/80'
                            }
                          `}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    
                    {showCustomTopic && (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={customTopic}
                          onChange={(e) => setCustomTopic(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3 text-gray-100
                            placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30
                            focus:border-purple-500/30 transition-all duration-200 hover:bg-[#0a0a0a]/70
                            hover:border-gray-700"
                          placeholder="Enter custom topic..."
                        />
                      </div>
                    )}
                  </div>
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
                          py-3 rounded-xl text-sm font-medium transition-all duration-200
                          ${difficulty === d
                            ? d === 'Easy'
                              ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50'
                              : d === 'Medium'
                              ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50'
                              : 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                            : 'bg-[#0a0a0a] text-gray-400 hover:bg-[#0a0a0a]/70 hover:text-gray-300 border border-gray-700'
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
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-[300px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 placeholder-gray-500 focus:outline-none
                      focus:ring-[1px] focus:ring-white/30 focus:border-white/30 resize-none
                      transition-all duration-200 hover:bg-[#0a0a0a]/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                    placeholder="Write your question description using Markdown..."
                    required
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Additional Info */}
          <div className="space-y-6">
            {/* Examples Section */}
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Examples</label>
                <div className="relative">
                  <textarea
                    value={examples}
                    onChange={(e) => setExamples(e.target.value)}
                    className="w-full h-[200px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 placeholder-gray-500 focus:outline-none
                      focus:ring-[1px] focus:ring-white/30 focus:border-white/30 resize-none
                      transition-all duration-200 hover:bg-[#0a0a0a]/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                    placeholder="Input: nums = [1, 2, 3]&#10;Output: [1, 2, 3]&#10;Explanation: Example details..."
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>

            {/* Constraints Section */}
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50">
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Constraints</label>
                <div className="relative">
                  <textarea
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    className="w-full h-[150px] bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3
                      text-gray-100 placeholder-gray-500 focus:outline-none
                      focus:ring-[1px] focus:ring-white/30 focus:border-white/30 resize-none
                      transition-all duration-200 hover:bg-[#0a0a0a]/70
                      hover:border-gray-600 backdrop-blur-sm
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                      hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                    placeholder="Enter constraints..."
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                    Markdown supported
                  </div>
                </div>
              </div>
            </div>

            {/* Starter Code Section - All languages are mandatory */}
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                  Starter Code <span className="text-red-400">*</span>
                </h3>
                <p className="text-sm text-gray-400 mb-6">Provide starter code for all supported languages</p>

                {/* Language Selection */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSelectedLanguage(lang)}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                        ${selectedLanguage === lang
                          ? 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30'
                          : 'bg-gray-800/50 text-gray-400 hover:text-purple-300 hover:bg-gray-800/80'
                        }
                      `}
                    >
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Editor */}
                <div className="rounded-xl overflow-hidden border border-gray-800/50">
                  <Editor
                    height="300px"
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
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                      },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      tabSize: 2,
                    }}
                    beforeMount={(monaco) => {
                      monaco.editor.defineTheme('custom-dark', {
                        base: 'vs-dark',
                        inherit: true,
                        rules: [],
                        colors: {
                          'editor.background': '#0a0a0a',
                          'editor.lineHighlightBackground': '#00000050',
                          'editorLineNumber.foreground': '#666666',
                          'editorLineNumber.activeForeground': '#FFFFFF',
                          'editor.selectionBackground': '#404040',
                          'editor.inactiveSelectionBackground': '#303030',
                        }
                      });
                      monaco.editor.setTheme('custom-dark');
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Solutions */}
            <div className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50">
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-300">
                      Solutions (Optional)
                    </h3>

                    <button
                      type="button"
                      onClick={addSolution}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-300
                        rounded-xl transition-all duration-200 hover:bg-[#222222] ring-1 ring-gray-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Solution
                    </button>
                  </div>

                  {/* Language Tabs */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {availableLanguages.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLanguageTabChange(lang)}
                        className={`
                          px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                          ${selectedLanguage === lang
                            ? 'bg-[#1a1a1a] text-gray-200 ring-1 ring-gray-700'
                            : 'bg-[#0a0a0a] text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'
                          }
                        `}
                      >
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  {(solutions[selectedLanguage] || []).map((solution, index) => (
                    <div key={index} className="bg-[#111111] backdrop-blur-xl rounded-2xl border border-gray-800/50 p-6">
                      <div className="flex flex-col space-y-4 mb-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium text-gray-300">Solution {index + 1}</h3>
                          {(solutions[selectedLanguage] || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSolution(index)}
                              className="text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {/* Solution Title and Time Complexity */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Title <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={solution.title}
                              onChange={(e) => updateSolution(index, 'title', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3
                                text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1
                                focus:ring-gray-700 focus:border-gray-700 transition-all duration-200"
                              placeholder="e.g., Two-Pointer Approach"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Time Complexity <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={solution.timeComplexity}
                              onChange={(e) => updateSolution(index, 'timeComplexity', e.target.value)}
                              className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3
                                text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1
                                focus:ring-gray-700 focus:border-gray-700 transition-all duration-200"
                              placeholder="e.g., O(n log n)"
                            />
                          </div>
                        </div>

                        {/* Approach */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Approach (Optional)
                          </label>
                          <div className="relative">
                            <textarea
                              value={solution.approach}
                              onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                              className="w-full h-[150px] bg-[#0a0a0a] border border-gray-800 rounded-xl px-4 py-3
                                text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1
                                focus:ring-gray-700 focus:border-gray-700 transition-all duration-200 resize-none"
                              placeholder="Explain your approach here..."
                            />
                            <div className="absolute right-3 bottom-3 text-xs text-gray-600">
                              Markdown supported
                            </div>
                          </div>
                        </div>

                        {/* Code Editor */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Code <span className="text-red-400">*</span>
                          </label>
                          <div className="rounded-xl overflow-hidden border border-gray-800">
                            <Editor
                              height="300px"
                              defaultLanguage={solution.language || selectedLanguage}
                              value={solution.code}
                              onChange={(value) => updateSolution(index, 'code', value)}
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
                                  verticalScrollbarSize: 8,
                                  horizontalScrollbarSize: 8,
                                },
                                overviewRulerLanes: 0,
                                hideCursorInOverviewRuler: true,
                                overviewRulerBorder: false,
                                tabSize: 2,
                              }}
                              beforeMount={(monaco) => {
                                monaco.editor.defineTheme('custom-dark', {
                                  base: 'vs-dark',
                                  inherit: true,
                                  rules: [],
                                  colors: {
                                    'editor.background': '#0a0a0a',
                                    'editor.lineHighlightBackground': '#00000050',
                                    'editorLineNumber.foreground': '#666666',
                                    'editorLineNumber.activeForeground': '#FFFFFF',
                                    'editor.selectionBackground': '#404040',
                                    'editor.inactiveSelectionBackground': '#303030',
                                  }
                                });
                                monaco.editor.setTheme('custom-dark');
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
            <div className="w-full">
              <button
                type="submit"
                className="w-full px-6 py-4 bg-gradient-to-r from-emerald-600/20 via-emerald-500/20 to-emerald-600/20 
                  text-emerald-400 font-medium rounded-xl 
                  border border-emerald-500/20 hover:border-emerald-500/30
                  hover:bg-gradient-to-r hover:from-emerald-600/30 hover:via-emerald-500/30 hover:to-emerald-600/30
                  shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] 
                  transition-all duration-300 transform hover:-translate-y-0.5
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/20
                  text-base flex items-center justify-center gap-3 group backdrop-blur-sm"
              >
                <span className="relative flex items-center gap-2">
                  Create Question
                  <svg 
                    className="w-5 h-5 transition-transform group-hover:translate-x-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
