'use client'
import { useRef, useEffect, useState } from 'react';
import { format, parseISO, eachDayOfInterval, subMonths, startOfDay, endOfDay, isSameDay, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const db = getDatabase();
const auth = getAuth();

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
      const user = auth.currentUser;
      if (!user) return;

      try {
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
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current;
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      
      // Always scroll to show the current month
      const currentMonthElement = scrollContainer.querySelector('[data-current-month="true"]');
      if (currentMonthElement) {
        const containerLeft = scrollContainer.getBoundingClientRect().left;
        const elementLeft = currentMonthElement.getBoundingClientRect().left;
        const scrollOffset = elementLeft - containerLeft - (clientWidth / 2) + (currentMonthElement.offsetWidth / 2);
        
        scrollContainer.scrollTo({
          left: scrollOffset,
          behavior: 'smooth'
        });
      }
    }
  }, []);

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
      y: rect.top + window.scrollY - 40
    });
  };

  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 md:p-5 backdrop-blur-sm border border-gray-700">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-lg font-semibold text-white">Activity</h3>
        <div className="text-sm text-gray-400">
          Current streak: <span className="text-blue-400 font-semibold">{streak} days</span>
        </div>
      </div>
      
      <div ref={scrollRef} className="overflow-x-auto pb-2 md:pb-3 hide-scrollbar">
        <div className="flex gap-2 md:gap-3 min-w-max mx-auto" style={{ width: 'fit-content' }}>
          {Object.entries(monthlyData).map(([month, days]) => {
            const isCurrentMonth = month === format(today, 'MMM yyyy');
            return (
              <div 
                key={month} 
                className="flex flex-col gap-1"
                data-current-month={isCurrentMonth}
              >
                <div className={`text-xs mb-1 ${isCurrentMonth ? 'text-blue-400 font-medium' : 'text-gray-400'}`}>
                  {month}
                </div>
                <div className="grid grid-cols-7 gap-[2px]">
                  {days.map((date, index) => {
                    if (!date) {
                      return <div key={index} className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm bg-transparent" />;
                    }
                    const dayTimestamp = startOfDay(date).getTime();
                    const dayCount = streakData[dayTimestamp]?.count || 0;
                    const level = getActivityLevel(dayCount);
                    const isFutureDate = date > today;

                    return (
                      <div
                        key={date.getTime()}
                        className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm transition-all duration-200 cursor-pointer
                          ${isFutureDate ? 'bg-gray-800/30' : // Future dates are more dimmed
                            `${level === 0 && 'bg-gray-700/50'}
                            ${level === 1 && 'bg-blue-900/50'}
                            ${level === 2 && 'bg-blue-700/50'}
                            ${level === 3 && 'bg-blue-500/50'}
                            ${level === 4 && 'bg-blue-400/50'}`
                          }
                          hover:scale-150 hover:z-10
                          origin-center
                        `}
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
          className="fixed z-50 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs shadow-lg pointer-events-none transform -translate-x-1/2"
          style={{
            left: tooltipContent.x,
            top: tooltipContent.y
          }}
        >
          {tooltipContent.text}
        </div>
      )}
    </div>
  );
};

export default ActivityHeatmap;
