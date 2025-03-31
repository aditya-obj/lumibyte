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
      const questionData = {
        title,
        description,
        examples,
        constraints,
        topic: finalTopic, // Use finalTopic here
        difficulty,
        empty_code: startCode,
        solutions: solutions,
        createdAt: Date.now(),
        userId: auth.currentUser.uid
      };

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
      
      // Optionally scroll to top or show persistent success message
      window.scrollTo(0, 0); 
      setTimeout(() => setSuccess(false), 3000); // Hide success message after 3 seconds

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
        {/* Use Grid for layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column 1 */}
          <div className="space-y-6">
            {/* Question Title */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label htmlFor="title" className="block text-sm font-medium mb-2 text-gray-300">Question Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-purple-500 outline-none" // Simplified focus: only border color
                placeholder="Enter question title..."
                required
              />
            </div>

            {/* Topic Selection */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label className="block text-sm font-medium mb-3 text-gray-300">Topic</label>
              <div className="flex flex-wrap gap-2 justify-start"> {/* Adjusted gap and alignment */}
                {topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTopic(t);
                      setShowCustomTopic(t === 'Others');
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs sm:text-sm transition-all duration-300 border cursor-pointer ${ /* Added cursor-pointer */
                      topic === t
                        ? 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/30'
                        : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-700/60 hover:border-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              
              {/* Custom Topic Input */}
              {showCustomTopic && (
                <div className="mt-4">
                   <label htmlFor="customTopic" className="block text-xs font-medium mb-1 text-gray-400">Enter Custom Topic:</label>
                   <input
                    id="customTopic"
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-purple-500 outline-none text-sm" // Simplified focus: only border color
                    placeholder="Your custom topic name..."
                    required={showCustomTopic} // Make required only if shown
                  />
                </div>
              )}
            </div>

             {/* Difficulty Selection */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label className="block text-sm font-medium mb-3 text-gray-300">Difficulty</label>
              <div className="flex flex-wrap gap-3"> {/* Added flex-wrap */}
                {['Easy', 'Medium', 'Hard'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`px-4 py-1.5 rounded-full text-xs sm:text-sm transition-all duration-300 border cursor-pointer ${ /* Adjusted padding and added cursor-pointer */
                      difficulty === d
                        ? d.toLowerCase() === 'easy'
                          ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-md shadow-green-500/20'
                          : d.toLowerCase() === 'medium'
                          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 shadow-md shadow-yellow-500/20'
                          : 'bg-red-500/20 border-red-500/50 text-red-300 shadow-md shadow-red-500/20'
                        : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-700/60 hover:border-gray-600'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Description */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label htmlFor="description" className="block text-sm font-medium mb-2 text-gray-300">Description (Markdown)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-48 sm:h-64 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-purple-500 outline-none resize-y" // Simplified focus: only border color
                placeholder="Enter question description..."
                required
              />
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            {/* Examples */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label htmlFor="examples" className="block text-sm font-medium mb-2 text-gray-300">Examples (Markdown)</label>
              <textarea
                id="examples"
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                required
                className="w-full h-40 sm:h-48 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-purple-500 outline-none font-mono resize-y" // Simplified focus: only border color
                placeholder="Add example inputs and outputs..."
              />
            </div>

            {/* Constraints */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label htmlFor="constraints" className="block text-sm font-medium mb-2 text-gray-300">Constraints (Markdown)</label>
              <textarea
                id="constraints"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                required
                className="w-full h-32 sm:h-40 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:border-purple-500 outline-none font-mono resize-y" // Simplified focus: only border color
                placeholder="Add problem constraints..."
              />
            </div>

            {/* Starter Code */}
            <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
              <label className="block text-sm font-medium mb-2 text-gray-300">Starter Code</label>
              <div className="h-[200px] rounded-lg overflow-hidden border border-gray-700"> {/* Added border */}
                 <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={startCode}
                  onChange={setStartCode}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13, // Slightly smaller font
                    scrollBeyondLastLine: false,
                    padding: { top: 10, bottom: 10 },
                    automaticLayout: true, // Ensure editor adjusts to container size
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Solutions Section (Full Width Below Grid) */}
        <div className="glass-container p-4 sm:p-6 rounded-xl backdrop-blur-sm border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-300">Solutions</label>
            <button
              type="button"
              onClick={() => setSolutions([...solutions, { title: '', code: '', timeComplexity: '', approach: '' }])}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-300 cursor-pointer" // Adjusted style and added cursor-pointer
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
               </svg>
              Add Solution
            </button>
          </div>
          
          {/* Solutions List */}
          <div className="space-y-6">
            {solutions.map((solution, index) => (
              <div key={index} className="p-4 rounded-lg bg-gray-800/40 border border-gray-700 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base sm:text-lg font-medium text-gray-200">Solution {index + 1}</h3>
                  {index > 0 && ( // Only show remove button if it's not the first solution
                    <button
                      type="button"
                      onClick={() => setSolutions(solutions.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-red-500/10 cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                {/* Title and Time Complexity side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor={`sol-title-${index}`} className="block text-xs font-medium mb-1 text-gray-400">Title</label>
                    <input
                      id={`sol-title-${index}`}
                      type="text"
                      value={solution.title}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].title = e.target.value;
                      setSolutions(newSolutions);
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-700/50 border border-gray-600 focus:border-purple-500 outline-none" // Simplified focus: only border color, removed ring-1
                    placeholder="e.g., Brute Force"
                  />
                  </div>
                  <div>
                    <label htmlFor={`sol-tc-${index}`} className="block text-xs font-medium mb-1 text-gray-400">Time Complexity</label>
                    <input
                      id={`sol-tc-${index}`}
                      type="text"
                      value={solution.timeComplexity}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].timeComplexity = e.target.value;
                      setSolutions(newSolutions);
                    }}
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-700/50 border border-gray-600 focus:border-purple-500 outline-none" // Simplified focus: only border color, removed ring-1
                    placeholder="e.g., O(n^2)"
                  />
                  </div>
                </div>

                {/* Optional Approach field */}
                <div className="mb-4">
                  <label htmlFor={`sol-approach-${index}`} className="block text-xs font-medium mb-1 text-gray-400">
                    Approach (Optional)
                  </label>
                  <textarea
                    id={`sol-approach-${index}`}
                    value={solution.approach}
                    onChange={(e) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].approach = e.target.value;
                      setSolutions(newSolutions);
                    }}
                    rows={3} // Use rows for better default height
                    className="w-full px-3 py-1.5 text-sm rounded-md bg-gray-700/50 border border-gray-600 focus:border-purple-500 outline-none resize-y" // Simplified focus: only border color, removed ring-1
                    placeholder="Explain your approach..."
                  />
                </div>

                {/* Code Editor */}
                 <label className="block text-xs font-medium mb-1 text-gray-400">Implementation</label>
                <div className="h-[250px] sm:h-[300px] rounded-md overflow-hidden border border-gray-600"> {/* Adjusted height */}
                  <Editor
                    height="100%"
                    defaultValue={solution.code} // Use defaultValue for initial render
                    value={solution.code} // Controlled component
                    language="python"
                    theme="vs-dark"
                    onChange={(value) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].code = value || ''; // Ensure value is not undefined
                      setSolutions(newSolutions);
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      padding: { top: 10, bottom: 10 },
                      automaticLayout: true,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button (Full Width) */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-1 font-semibold text-lg cursor-pointer" // Added cursor-pointer
        >
          Add Question
        </button>
      </form>
    </div>
  );
}
