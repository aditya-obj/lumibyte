'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/components/firebase.config';
import { ref, push, get, set } from 'firebase/database';
import Editor from '@monaco-editor/react';

export default function QuestionsPage() {
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
          const allTopics = [...new Set([...publicTopics, ...userTopics, 'Others'])];
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

    if (topic) {
      const topicsRef = ref(db, `users/${auth.currentUser.uid}/topics`);
      const topicId = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Get existing topics to check for duplicates
      const snapshot = await get(topicsRef);
      const existingTopics = snapshot.val() || {};
      
      // Only add if topic doesn't already exist and it's not 'Others'
      if (!Object.values(existingTopics).includes(topic) && topic !== 'Others') {
        const updates = { ...existingTopics };
        updates[topicId] = topic;
        await set(topicsRef, updates);
        setTopics(prevTopics => {
          const newTopics = [...prevTopics.filter(t => t !== 'Others'), topic, 'Others'];
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
        topic,
        difficulty,
        empty_code: startCode,
        solutions: solutions,
        createdAt: Date.now(),
        userId: auth.currentUser.uid
      };

      const userQuestionsRef = ref(db, `users/${auth.currentUser.uid}/questions`);
      await push(userQuestionsRef, questionData);

      setSuccess(true);
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
      setStartCode('def solution():\n    # Write your code here\n    pass');
    } catch (err) {
      setError('Failed to add question. Please try again.');
      console.error('Error adding question:', err);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center">
      {/* Main content container with max-width */}
      <div className="w-full max-w-5xl space-y-6">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-8">Add New Question</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question Title */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Question Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              placeholder="Enter question title..."
              required
            />
          </div>

          {/* Topic Selection */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Topic</label>
            <div className="flex flex-wrap gap-3 justify-center">
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTopic(t);
                    if (t === 'Others') {
                      setShowCustomTopic(true);
                    } else {
                      setShowCustomTopic(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-full transition-all duration-300 ${
                    topic === t
                      ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            
            {/* Custom Topic Input */}
            {showCustomTopic && (
              <input
                type="text"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                placeholder="Enter custom topic..."
              />
            )}
          </div>

          {/* Question Description */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-[800px] h-[200px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-none"
              placeholder="Enter question description..."
              required
            />
          </div>

          {/* Examples */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Examples (Markdown)</label>
            <textarea
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              required
              className="w-[800px] h-[150px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 font-mono resize-none"
              placeholder="Add example inputs and outputs..."
            />
          </div>

          {/* Constraints */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Constraints (Markdown)</label>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              required
              className="w-[800px] h-[100px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 font-mono resize-none"
              placeholder="Add problem constraints..."
            />
          </div>

          {/* Difficulty Selection */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Difficulty</label>
            <div className="flex gap-3">
              {['Easy', 'Medium', 'Hard'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`px-6 py-2 rounded-full transition-all duration-300 ${
                    difficulty === d
                      ? d.toLowerCase() === 'easy'
                        ? 'bg-green-500/20 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                        : d.toLowerCase() === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                        : 'bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Starter Code */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <label className="block text-sm font-medium mb-2 text-gray-300">Starter Code</label>
            <Editor
              height="200px"
              defaultLanguage="python"
              value={startCode}
              onChange={setStartCode}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
              }}
              className="rounded-lg overflow-hidden"
            />
          </div>

          {/* Solutions */}
          <div className="glass-container p-6 rounded-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-300">Solutions</label>
              <button
                type="button"
                onClick={() => setSolutions([...solutions, { title: '', code: '', timeComplexity: '', approach: '' }])}
                className="glass-button bg-gradient-to-r from-green-400 to-emerald-500 text-white w-8 h-8 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:-translate-y-1 flex items-center justify-center text-xl"
              >
                +
              </button>
            </div>
            
            {solutions.map((solution, index) => (
              <div key={index} className="mb-6 last:mb-0 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-300">Solution {index + 1}</h3>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => setSolutions(solutions.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                {/* Title and Time Complexity side by side */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Title</label>
                    <input
                      type="text"
                      value={solution.title}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].title = e.target.value;
                        setSolutions(newSolutions);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="Solution title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Time Complexity</label>
                    <input
                      type="text"
                      value={solution.timeComplexity}
                      onChange={(e) => {
                        const newSolutions = [...solutions];
                        newSolutions[index].timeComplexity = e.target.value;
                        setSolutions(newSolutions);
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                      placeholder="e.g., O(n)"
                    />
                  </div>
                </div>

                {/* Optional Approach field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Approach (Optional)
                  </label>
                  <textarea
                    value={solution.approach}
                    onChange={(e) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].approach = e.target.value;
                      setSolutions(newSolutions);
                    }}
                    className="w-[800px] h-[150px] px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-none"
                    placeholder="Explain your approach..."
                  />
                </div>

                {/* Code Editor */}
                <div className="h-[300px] rounded-lg overflow-hidden">
                  <Editor
                    height="100%"
                    defaultValue={solution.code}
                    language="python"
                    theme="vs-dark"
                    onChange={(value) => {
                      const newSolutions = [...solutions];
                      newSolutions[index].code = value;
                      setSolutions(newSolutions);
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      padding: { top: 16, bottom: 16 },
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full glass-button bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] hover:-translate-y-1"
          >
            Add Question
          </button>
        </form>
      </div>
    </div>
  );
}
