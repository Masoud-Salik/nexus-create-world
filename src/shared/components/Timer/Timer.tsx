import React, { useState, useEffect, useCallback } from 'react';

export interface TimerProps {
  duration: number; // in seconds
  isRunning: boolean;
  isPaused: boolean;
  onComplete?: () => void;
  onTick?: (remainingTime: number) => void;
  className?: string;
  showControls?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

export const Timer: React.FC<TimerProps> = ({
  duration,
  isRunning,
  isPaused,
  onComplete,
  onTick,
  className = '',
  showControls = true,
  onStart,
  onPause,
  onResume,
  onStop
}) => {
  const [remainingTime, setRemainingTime] = useState(duration);
  const [progress, setProgress] = useState(100);

  // Update remaining time when duration changes
  useEffect(() => {
    setRemainingTime(duration);
    setProgress(100);
  }, [duration]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime((prev) => {
          const newTime = prev - 1;
          const newProgress = (newTime / duration) * 100;
          setProgress(newProgress);
          
          onTick?.(newTime);
          
          if (newTime <= 0) {
            onComplete?.();
            return 0;
          }
          
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, remainingTime, duration, onTick, onComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (remainingTime > 0) {
      onStart?.();
    }
  };

  const handlePause = () => {
    onPause?.();
  };

  const handleResume = () => {
    onResume?.();
  };

  const handleStop = () => {
    onStop?.();
    setRemainingTime(duration);
    setProgress(100);
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Timer Display */}
      <div className="relative">
        {/* Progress Ring */}
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress / 100)}`}
            className="text-blue-500 transition-all duration-1000 ease-linear"
          />
        </svg>
        
        {/* Time Display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">
            {formatTime(remainingTime)}
          </span>
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={remainingTime === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start
            </button>
          ) : isPaused ? (
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Resume
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
            >
              Pause
            </button>
          )}
          
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Stop
          </button>
        </div>
      )}

      {/* Status Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          isRunning && !isPaused ? 'bg-green-500' : 
          isPaused ? 'bg-yellow-500' : 'bg-gray-400'
        }`} />
        <span className="text-sm text-gray-600">
          {isRunning && !isPaused ? 'Running' : 
           isPaused ? 'Paused' : 'Stopped'}
        </span>
      </div>
    </div>
  );
};
