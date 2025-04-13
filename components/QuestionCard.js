import Link from 'next/link';
import { createSlug } from '@/utils/slugUtils';
import { format } from 'date-fns';

export default function QuestionCard({ question, user }) {
  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
        return 'text-green-500 bg-green-500/10';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'hard':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not revised';
    return format(timestamp, 'MMM d, yyyy');
  };

  return (
    <Link
      href={`/${createSlug(question.topic)}/${createSlug(question.title)}`}
      className="block bg-[#1a1a1a] rounded-xl p-6 hover:bg-[#242424] transition-colors duration-200"
    >
      <div className="flex flex-col h-full">
        {/* Title and Difficulty */}
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white mb-2">
            {question.title}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </span>
          </div>
        </div>

        {/* Last Revised */}
        <div className="mt-auto pt-4 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">
              Last revised
            </span>
            <span className={`text-sm ${question.lastRevised ? 'text-purple-400' : 'text-gray-500'}`}>
              {formatDate(question.lastRevised)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}