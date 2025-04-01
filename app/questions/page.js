'use client';
import { auth, db } from '@/components/firebase.config';
import Editor from '@monaco-editor/react';
import { get, push, ref, set } from 'firebase/database';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function QuestionsPage() {
  const router = useRouter(); // Initialize router
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState('');
  const [constraints, setConstraints] = useState('');
  const [topic, setTopic] = useState('');
  const [showCustomTopic, setShowCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState(['Others']);
  const [questionLink, setQuestionLink] = useState('');

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
  const [startCode, setStartCode] = useState('def solution():\n    # Write your code here\n    pass');
  const [solutions, setSolutions] = useState([{
    title: '',
    code: 'def solution():\n    # Write your solution here\n    pass',
    timeComplexity: '',
    approach: ''
  }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const addSolution = () => {
    setSolutions([...solutions, {
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]);
  };

  const removeSolution = (index) => {
    const newSolutions = solutions.filter((_, i) => i !== index);
    setSolutions(newSolutions.length > 0 ? newSolutions : [{
      title: '',
      code: 'def solution():\n    # Write your solution here\n    pass',
      timeComplexity: '',
      approach: ''
    }]);
  };

  const updateSolution = (index, field, value) => {
    const newSolutions = [...solutions];
    newSolutions[index][field] = value;
    setSolutions(newSolutions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!auth.currentUser) {
      setError('Please login to add questions');
      return;
    }

    const finalTopic = showCustomTopic ? customTopic : topic;
    if (!finalTopic) {
      setError('Please select or enter a topic.');
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
      // Filter out empty solutions
      const validSolutions = solutions.filter(solution => 
        solution.title.trim() || 
        solution.code.trim() !== 'def solution():\n    # Write your solution here\n    pass' ||
        solution.timeComplexity.trim() ||
        solution.approach.trim()
      );

      // Validate solutions if any are provided
      const hasIncompleteSolution = validSolutions.some(solution => 
        (solution.title || solution.code || solution.timeComplexity) && 
        (!solution.title.trim() || !solution.code.trim() || !solution.timeComplexity.trim())
      );

      if (hasIncompleteSolution) {
        setError('Please complete all required fields (Title, Code, Time Complexity) for each solution or remove incomplete solutions');
        return;
      }

      const questionData = {
        title,
        questionLink,
        description,
        examples,
        constraints,
        topic: finalTopic,
        difficulty,
        empty_code: startCode,
        createdAt: Date.now(),
        userId: auth.currentUser.uid
      };

      // Only add solutions to questionData if there are valid solutions
      if (validSolutions.length > 0) {
        questionData.solutions = validSolutions;
      }

      const userQuestionsRef = ref(db, `users/${auth.currentUser.uid}/questions`);
      await push(userQuestionsRef, questionData);

      setSuccess(true);
      // Reset form fields
      setTitle('');
      setDescription('');
      setExamples('');
      setConstraints('');
      setTopic('');
      setCustomTopic('');
      setShowCustomTopic(false);
      setDifficulty('Easy');
      setStartCode('def solution():\n    # Write your code here\n    pass');
      setSolutions([{
        title: '',
        code: 'def solution():\n    # Write your solution here\n    pass',
        timeComplexity: '',
        approach: ''
      }]);
      setQuestionLink('');

      window.scrollTo(0, 0);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      setError('Failed to add question. Please try again.');
      console.error('Error adding question:', err);
    }
  };

  return (
    // Adjusted padding for better spacing on different screens
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-gray-900 text-gray-200">
      {/* Header section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="universal-back-button"
            aria-label="Go back"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2}
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
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
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 
                  focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
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
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 
                  focus:border-transparent transition-all duration-200 hover:bg-gray-900/70"
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
                        : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
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
                        : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800/70 hover:text-gray-300'
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
                className="w-full h-[250px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 
                  text-gray-100 font-mono text-sm placeholder-gray-500 focus:outline-none focus:ring-2 
                  focus:ring-purple-500/50 focus:border-transparent resize-none
                  transition-all duration-200 hover:bg-gray-900/70
                  hover:border-gray-600 backdrop-blur-sm
                  shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]
                  hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]
                  scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/50"
                placeholder="Enter the problem description..."
                required
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

        {/* Starter Code Section */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50">
          <div className="p-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Starter Code</label>
            <div className="h-[200px] rounded-xl overflow-hidden border border-gray-700">
              <Editor
                height="100%"
                defaultLanguage="python"
                value={startCode}
                onChange={setStartCode}
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

            {solutions.map((solution, index) => (
              <div key={index} className="mb-8 p-6 bg-gray-800/30 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-purple-300">Solution {index + 1}</h3>
                  {/* Show remove button only if there's more than one solution AND it's not the first solution */}
                  {solutions.length > 1 && index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeSolution(index)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Title and Time Complexity in one line */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Solution Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={solution.title}
                      onChange={(e) => updateSolution(index, 'title', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Solution title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Time Complexity <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={solution.timeComplexity}
                      onChange={(e) => updateSolution(index, 'timeComplexity', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="e.g., O(n)"
                    />
                  </div>
                </div>

                {/* Approach in another line with increased height */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Approach (Optional)
                  </label>
                  <textarea
                    value={solution.approach}
                    onChange={(e) => updateSolution(index, 'approach', e.target.value)}
                    className="w-full h-[200px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Explain your approach..."
                  />
                </div>

                {/* Code Editor */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Code <span className="text-red-400">*</span>
                  </label>
                  <div className="h-[300px] rounded-lg overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="python"
                      value={solution.code}
                      onChange={(value) => updateSolution(index, 'code', value)}
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
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl 
            transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-1 
            font-semibold text-lg"
        >
          Add Question
        </button>

        {/* Error Message */}
        {error && (
          <div className="text-red-400 text-sm mt-2">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="text-green-400 text-sm mt-2">
            Question added successfully!
          </div>
        )}
      </form>
    </div>
  );
}
