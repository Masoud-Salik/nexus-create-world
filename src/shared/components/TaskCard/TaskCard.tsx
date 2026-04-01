import React from 'react';
import { StudyTask } from '../../core/domain/models/Study';

export interface TaskCardProps {
  task: StudyTask;
  onPress?: (task: StudyTask) => void;
  onComplete?: (taskId: string) => void;
  onEdit?: (task: StudyTask) => void;
  onDelete?: (taskId: string) => void;
  isSelected?: boolean;
  showActions?: boolean;
  className?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onComplete,
  onEdit,
  onDelete,
  isSelected = false,
  showActions = true,
  className = ''
}) => {
  const getPriorityColor = (priority: StudyTask['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-500 bg-green-50 border-green-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getDifficultyColor = (difficulty: StudyTask['difficulty']) => {
    switch (difficulty) {
      case 'hard': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'easy': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: StudyTask['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'skipped': return 'bg-gray-100 text-gray-800';
      default: return 'bg-white text-gray-800';
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  return (
    <div
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
      } ${className}`}
      onClick={() => onPress?.(task)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
          )}
        </div>
        
        {/* Status Badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>

      {/* Meta Information */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <span className="font-medium">{task.subject}</span>
        <span>•</span>
        <span>{formatDuration(task.estimated_duration)}</span>
        <span>•</span>
        <span className={getDifficultyColor(task.difficulty)}>
          {task.difficulty}
        </span>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Priority Indicator */}
      <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${getPriorityColor(task.priority)}`}>
        <span className="w-2 h-2 rounded-full bg-current mr-1" />
        {task.priority} priority
      </div>

      {/* Due Date */}
      {task.due_date && (
        <div className="mt-2 text-xs text-gray-500">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </div>
      )}

      {/* Action Buttons */}
      {showActions && task.status !== 'completed' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {task.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete?.(task.id);
              }}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Complete
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(task);
            }}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(task.id);
            }}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
