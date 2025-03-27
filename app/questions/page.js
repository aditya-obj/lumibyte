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
        const topicsRef = ref(db, `users/${user.uid}/topics`);
        get(topicsRef).then((snapshot) => {
          if (snapshot.exists()) {
            const topicsData = snapshot.val();
            setTopics([...Object.values(topicsData), 'Others']);
          } else {
            setTopics(['Others']);
          }
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
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Add New Question</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Question added successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <div>
          <label className="block text-sm font-medium mb-2">Question Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Question Description (Markdown)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Write your question description using Markdown format"
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Examples (Markdown)</label>
          <textarea
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            required
            rows={3}
            placeholder="Provide example inputs and outputs using Markdown format"
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Constraints (Markdown)</label>
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            required
            rows={2}
            placeholder="List the constraints using Markdown format"
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Topic</label>
          <select
            value={showCustomTopic ? 'Others' : topic}
            onChange={(e) => {
              const selectedTopic = e.target.value;
              if (selectedTopic === 'Others') {
                setShowCustomTopic(true);
                if (!customTopic) {
                  setTopic('');
                }
              } else {
                setShowCustomTopic(false);
                setCustomTopic('');
                setTopic(selectedTopic);
              }
            }}
            required
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Select a topic</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {showCustomTopic && (
            <input
              type="text"
              value={customTopic}
              onChange={(e) => {
                const newTopic = e.target.value;
                setCustomTopic(newTopic);
                setTopic(newTopic);
              }}
              placeholder="Enter custom topic"
              required
              className="mt-2 w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Difficulty</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Start Code</label>
          <div className="h-[300px] rounded-lg overflow-hidden border">
            <Editor
              height="100%"
              value={startCode}
              language="python"
              theme="vs-dark"
              onChange={setStartCode}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Solutions</label>
          {solutions.map((solution, index) => (
            <div key={index} className="mb-6 p-4 border rounded-lg">
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={solution.title}
                  onChange={(e) => {
                    const newSolutions = [...solutions];
                    newSolutions[index].title = e.target.value;
                    setSolutions(newSolutions);
                  }}
                  placeholder="Solution Title"
                  required
                  className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <input
                  type="text"
                  value={solution.timeComplexity}
                  onChange={(e) => {
                    const newSolutions = [...solutions];
                    newSolutions[index].timeComplexity = e.target.value;
                    setSolutions(newSolutions);
                  }}
                  placeholder="Time Complexity (e.g. O(n))"
                  required
                  className="flex-1 px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <textarea
                value={solution.approach}
                onChange={(e) => {
                  const newSolutions = [...solutions];
                  newSolutions[index].approach = e.target.value;
                  setSolutions(newSolutions);
                }}
                placeholder="Solution Approach (Optional)"
                rows={2}
                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
              />
              {solutions.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newSolutions = solutions.filter((_, i) => i !== index);
                    setSolutions(newSolutions);
                  }}
                  className="text-red-500 hover:text-red-700 mb-4"
                >
                  Delete
                </button>
              )}
              <div className="h-[300px] rounded-lg overflow-hidden border">
                <Editor
                  height="100%"
                  value={solution.code}
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
                    padding: { top: 12, bottom: 12 }
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSolutions([...solutions, { title: '', code: 'def solution():\n    # Write your solution here\n    pass', timeComplexity: '', approach: '' }])}
            className="mt-4 flex items-center text-primary hover:text-primary-hover"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Another Solution
          </button>
        </div>

        <button
          type="submit"
          className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg transition-colors"
        >
          Add Question
        </button>
      </form>
    </div>
  );
}