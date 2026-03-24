import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useStudyStore } from '../../../src/application/stores/studyStore';
import { useAuthStore } from '../../../src/application/stores/authStore';
import { StudyTimer } from '../../../src/components/study/StudyTimer';
import { TaskList } from '../../../src/components/study/TaskList';
import { StatsCard } from '../../../src/components/study/StatsCard';
import { SubjectProgress } from '../../../src/components/study/SubjectProgress';
import { FloatingButton } from '../../../src/components/ui/FloatingButton';

export default function StudyScreen() {
  const { user } = useAuthStore();
  const { 
    currentTask, 
    tasks, 
    timerState, 
    subjects,
    setCurrentTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer
  } = useStudyStore();

  const [selectedTab, setSelectedTab] = useState<'timer' | 'tasks' | 'stats'>('timer');

  useEffect(() => {
    // Load today's tasks and stats
    // This would be replaced with actual data loading
  }, []);

  const handleTaskSelect = (task: any) => {
    setCurrentTask(task);
  };

  const handleStartSession = () => {
    if (currentTask) {
      startTimer(25 * 60, 'pomodoro'); // 25 minutes
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-indigo-600 px-4 pt-12 pb-6">
        <Text className="text-white text-2xl font-bold">
          Welcome back, {user?.name || 'Student'}!
        </Text>
        <Text className="text-indigo-100 mt-1">
          Ready to achieve your study goals?
        </Text>
      </View>

      {/* Tab Selector */}
      <View className="flex-row bg-white border-b border-gray-200">
        {(['timer', 'tasks', 'stats'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setSelectedTab(tab)}
            className={`flex-1 py-3 ${
              selectedTab === tab ? 'border-b-2 border-indigo-600' : ''
            }`}
          >
            <Text
              className={`text-center capitalize ${
                selectedTab === tab ? 'text-indigo-600 font-semibold' : 'text-gray-500'
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-4">
        {selectedTab === 'timer' && (
          <View className="space-y-4">
            <StudyTimer
              currentTask={currentTask}
              timerState={timerState}
              onStart={handleStartSession}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onStop={stopTimer}
            />
            
            {subjects.length > 0 && (
              <SubjectProgress subjects={subjects} />
            )}
          </View>
        )}

        {selectedTab === 'tasks' && (
          <TaskList
            tasks={tasks}
            currentTask={currentTask}
            onTaskSelect={handleTaskSelect}
          />
        )}

        {selectedTab === 'stats' && (
          <View className="space-y-4">
            <StatsCard title="Today's Progress" />
            <StatsCard title="Weekly Overview" />
            <StatsCard title="Subject Breakdown" />
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingButton
        icon="plus"
        onPress={() => {
          // Navigate to add task screen
        }}
      />
    </View>
  );
}
