'use client';

import { Task, TaskStatus, Priority } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, CheckCircle, Edit2, Trash2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleStatus: (task: Task) => void;
  getPriorityColor: (priority: Priority) => string;
  getPriorityName: (priority: Priority) => string;
  getStatusName: (status: TaskStatus) => string;
  getTaskUrgency: (task: Task) => string | null;
}

export default function TaskDetailModal({
  task,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  getPriorityColor,
  getPriorityName,
  getStatusName,
  getTaskUrgency,
}: TaskDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(task.priority)}`}>
                {getPriorityName(task.priority)}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                {getStatusName(task.status)}
              </span>
              {getTaskUrgency(task) === 'overdue' && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Vencida
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{task.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          {task.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Descripción</p>
              <p className="text-sm text-gray-600">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {task.dueDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Fecha límite</p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {format(task.dueDate, 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Categoría</p>
              <p className="text-sm text-gray-600">{task.category}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Creada</p>
            <p className="text-sm text-gray-600">
              {format(task.createdAt, "dd MMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>

          {task.completedAt && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Completada</p>
              <p className="text-sm text-gray-600">
                {format(task.completedAt, "dd MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t">
          {task.status !== 'completed' && (
            <button
              onClick={() => {
                onToggleStatus(task);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Completar
            </button>
          )}
          <button
            onClick={() => {
              onEdit(task);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => {
              onClose();
              onDelete(task.id);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
