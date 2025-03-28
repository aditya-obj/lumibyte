'use client'
import { auth, db } from '@/components/firebase.config'; // Import initialized instances
import { eachDayOfInterval, endOfMonth, format, startOfDay, startOfMonth, subMonths } from 'date-fns';
// Removed direct imports of getAuth, getDatabase
import { get, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';

// Removed direct calls to getDatabase() and getAuth()

const ActivityHeatmap = ({ questions }) => {
  const [streakData, setStreakData] = useState({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const [tooltipContent, setTooltipContent] = useState(null);
  const today = new Date();
  const startDate = subMonths(today, 11); // Last 12 months

  // Generate array of dates for the last 12 months
  const dates = eachDayOfInterval({
    start: startDate,
    end: endOfMonth(today) // Changed from 'today' to end of current month
  });

  // Fetch streak data
  useEffect(() => {
    const fetchStreakData = async () => {
      // Get user directly from the imported auth instance
      const user = auth.currentUser; 
      if (!user) {
        console.log("ActivityHeatmap: No user found, skipping streak fetch.");
        setLoading(false); // Ensure loading state is updated even if no user
        return;
      }

      try {
        // Use the imported db instance
        const streakRef = ref(db, `users/${user.uid}/streak`); 
        const snapshot = await get(streakRef);
        
        if (snapshot.exists()) {
          setStreakData(snapshot.val());
        }
      } catch (error) {
        console.error('Error fetching streak data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStreakData();
  }, []);

  // Calculate current streak
  const calculateStreak = () => {
    let streak = 0;
    let currentDate = today;

    while (true) {
      const startOfCurrentDay = startOfDay(currentDate).getTime();
      if (streakData[startOfCurrentDay]) {
        streak++;
        currentDate = new Date(currentDate.getTime() - 86400000); // Subtract one day
      } else {
        break;
      }
    }
    return streak;
  };

  // Get activity level (0-4) based on question count
  const getActivityLevel = (count) => {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
  };

  // Scroll to current month on small screens
  useEffect(() => {
    // Delay execution slightly to ensure layout is stable
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current;
        const currentMonthElement = scrollContainer.querySelector('[data-current-month="true"]');
        
        if (currentMonthElement) {
          // Use scrollIntoView for more reliable scrolling
          currentMonthElement.scrollIntoView({
            behavior: 'smooth', // Keep smooth scrolling
            inline: 'center',   // Try to center the element horizontally
            block: 'nearest'    // Keep the vertical position as close as possible
          });
        } else {
          console.log("ActivityHeatmap: Current month element not found for scrolling.");
        }
      }
    }, 50); // Increased delay slightly to 50ms just in case


    // Cleanup function to clear the timeout if the component unmounts
    return () => clearTimeout(timer); 
  }, [loading]); // Keep 'loading' dependency

  // Group dates by month and ensure full weeks
  const monthlyData = dates.reduce((acc, date) => {
    const monthKey = format(date, 'MMM yyyy');
    if (!acc[monthKey]) {
      // Get the first day of the month
      const firstOfMonth = startOfMonth(date);
      // Get the day of the week (0-6, 0 is Sunday)
      const startDay = firstOfMonth.getDay();
      // Add empty days at the start to align with weekday
      acc[monthKey] = Array(startDay).fill(null);
    }
    acc[monthKey].push(date);
    return acc;
  }, {});

  // Add empty days at the end of each month to complete the week
  Object.keys(monthlyData).forEach(month => {
    const daysCount = monthlyData[month].length;
    const remainingDays = 7 - (daysCount % 7);
    if (remainingDays < 7) {
      monthlyData[month] = [...monthlyData[month], ...Array(remainingDays).fill(null)];
    }
  });

  const streak = calculateStreak();

  // Handle mouse events for tooltip
  const handleMouseEnter = (e, date, count) => {
    const rect = e.target.getBoundingClientRect();
    setTooltipContent({
      text: `${format(date, 'MMM d, yyyy')}: ${count} ${count === 1 ? 'question' : 'questions'} revised`,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY, // Adjusted y position calculation slightly
      width: rect.width // Added width property
    });
  };

  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  const levelColors = [
    'bg-gray-700/40 border-gray-600/30', // Level 0
    'bg-sky-900/60 border-sky-700/40',   // Level 1
    'bg-sky-700/70 border-sky-500/50',   // Level 2
    'bg-sky-500/80 border-sky-400/60',   // Level 3
    'bg-sky-400 border-sky-300/70'       // Level 4
  ];

  const futureDateColor = 'bg-gray-800/30 border-gray-700/20';

  return (
    // Removed the container div, as it's now wrapped in the dashboard page
    <> 
      <div className="flex items-center justify-between mb-4">
        {/* Title moved to dashboard page */}
        <div className="text-sm text-gray-300">
          Current streak: <span className="text-sky-400 font-bold">{streak} days</span>
        </div>
      </div>
      
      <div ref={scrollRef} className="overflow-x-auto pb-3 hide-scrollbar -mx-1">
        <div className="flex gap-3 min-w-max px-1" style={{ width: 'fit-content' }}>
          {Object.entries(monthlyData).map(([month, days]) => {
            const isCurrentMonth = month === format(today, 'MMM yyyy');
            return (
              <div 
                key={month} 
                className="flex flex-col"
                data-current-month={isCurrentMonth}
              >
                <div className={`text-xs text-center mb-1.5 ${isCurrentMonth ? 'text-sky-400 font-semibold' : 'text-gray-400'}`}>
                  {month.substring(0, 3)} {/* Abbreviated month */}
                </div>
                <div className="grid grid-cols-7 gap-1"> {/* Increased gap */}
                  {days.map((date, index) => {
                    if (!date) {
                      // Placeholder for empty days to maintain grid structure
                      return <div key={`empty-${month}-${index}`} className="w-3 h-3 md:w-3.5 md:h-3.5" />;
                    }
                    
                    const dayTimestamp = startOfDay(date).getTime();
                    const dayCount = streakData[dayTimestamp]?.count || 0;
                    const level = getActivityLevel(dayCount);
                    const isFutureDate = date > today;
                    const colorClass = isFutureDate ? futureDateColor : levelColors[level];

                    return (
                      <div
                        key={date.toISOString()} // Use ISO string for a stable key
                        className={`w-3 h-3 md:w-3.5 md:h-3.5 rounded border transition-all duration-150 cursor-pointer ${colorClass} 
                          ${!isFutureDate ? 'hover:scale-125 hover:shadow-md hover:border-gray-300/80 hover:z-10' : 'opacity-60'}
                          origin-center`}
                        onMouseEnter={(e) => !isFutureDate && handleMouseEnter(e, date, dayCount)}
                        onMouseLeave={handleMouseLeave}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tooltipContent && (
        <div 
          className="fixed z-50 bg-gray-950 border border-gray-700 text-gray-200 px-2.5 py-1 rounded-md text-xs shadow-xl pointer-events-none transform -translate-x-1/2 whitespace-nowrap"
          style={{ 
            left: tooltipContent.x + (tooltipContent.width / 2), // Center tooltip horizontally
            top: tooltipContent.y - 35 // Position further above the square
          }}
        >
          {tooltipContent.text}
        </div>
      )}
    </> // Closing the fragment
  );
};

export default ActivityHeatmap;

// Helper CSS to hide scrollbar (add this to your global CSS if not already present)
/*
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none; 
  scrollbar-width: none; 
}
*/
