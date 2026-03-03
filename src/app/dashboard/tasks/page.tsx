'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Task, TaskStatus, Priority } from '@/types';
import { Plus, Edit2, Trash2, X, CheckCircle, Circle, Clock, Search, Filter, SortAsc, AlertCircle, TrendingUp, Calendar as CalendarIcon, List } from 'lucide-react';
import { format, isPast, isToday, isFuture, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import TaskDetailModal from './TaskDetailModal';
import TaskFormModal, { TaskFormData } from './TaskFormModal';

type SortMode = 'date' | 'priority' | 'title' | 'status';
type GroupMode = 'none' | 'priority' | 'status' | 'category';

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showSearch, setShowSearch] = useState(false);
  const [showTaskDetail, setShowTaskDetail] = useState<Task | null>(null);

  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    status: 'pending' as TaskStatus,
    priority: 'medium' as Priority,
    category: 'general',
    dueDate: '',
  });

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(tasksRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as Task;
      });
      setTasks(tasksData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const taskData = {
        userId: user.uid,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        category: formData.category,
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate)) : null,
        updatedAt: Timestamp.now(),
      };

      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...taskData,
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      loadTasks();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : '',
    });
    setShowModal(true);
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: newStatus,
        completedAt: newStatus === 'completed' ? Timestamp.now() : null,
        updatedAt: Timestamp.now(),
      });
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      category: 'general',
      dueDate: '',
    });
    setEditingTask(null);
    setShowModal(false);
  };

  // Filtrar, ordenar y agrupar tareas
  const getFilteredTasks = () => {
    let filtered = tasks;

    // Filtrar por estado
    if (filter !== 'all') {
      filtered = filtered.filter((t) => t.status === filter);
    }

    // Filtrar por prioridad
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }

    // Filtrar por búsqueda
    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Ordenar
    switch (sortMode) {
      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        break;
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'status':
        const statusOrder = { 'in-progress': 0, pending: 1, completed: 2, cancelled: 3 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
        break;
      case 'date':
      default:
        filtered.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return b.createdAt.getTime() - a.createdAt.getTime();
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        });
    }

    return filtered;
  };

  const groupTasks = (tasks: Task[]) => {
    if (groupMode === 'none') {
      return { 'Todas las tareas': tasks };
    }

    const grouped: Record<string, Task[]> = {};

    tasks.forEach((task) => {
      let key = '';
      switch (groupMode) {
        case 'priority':
          key = getPriorityName(task.priority);
          break;
        case 'status':
          key = getStatusName(task.status);
          break;
        case 'category':
          key = task.category;
          break;
      }
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(task);
    });

    return grouped;
  };

  const filteredTasks = getFilteredTasks();
  const groupedTasks = groupTasks(filteredTasks);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getPriorityName = (priority: Priority) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in-progress': return <Clock className="w-5 h-5 text-brand-navy" />;
      case 'cancelled': return <X className="w-5 h-5 text-gray-400" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusName = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in-progress': return 'En Progreso';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
    }
  };

  const getTaskUrgency = (task: Task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return null;
    if (task.priority === 'urgent') return 'urgent';
    if (!task.dueDate) return null;
    if (isPast(task.dueDate)) return 'overdue';
    if (isToday(task.dueDate)) return 'today';
    return null;
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    overdue: tasks.filter((t) => t.dueDate && isPast(t.dueDate) && t.status !== 'completed' && t.status !== 'cancelled').length,
    urgent: tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'cancelled').length,
    today: tasks.filter((t) => t.dueDate && isToday(t.dueDate) && t.status !== 'completed' && t.status !== 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Tareas</h2>
          <p className="text-sm text-gray-600 mt-1">
            {stats.completed} de {stats.total} tareas completadas
            {stats.overdue > 0 && <span className="text-red-600 ml-2">• {stats.overdue} vencidas</span>}
            {stats.today > 0 && <span className="text-brand-navy ml-2">• {stats.today} para hoy</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Buscar tareas"
          >
            <Search className={`w-5 h-5 ${showSearch ? 'text-brand-navy' : 'text-gray-600'}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-brand-navy text-white px-4 py-2 rounded-lg hover:bg-[#1a1870] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nueva Tarea
          </button>
        </div>
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tareas..."
              className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
              autoFocus
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
            >
              <option value="date">Ordenar por fecha</option>
              <option value="priority">Ordenar por prioridad</option>
              <option value="status">Ordenar por estado</option>
              <option value="title">Ordenar por título</option>
            </select>
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as GroupMode)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue"
            >
              <option value="none">Sin agrupar</option>
              <option value="priority">Agrupar por prioridad</option>
              <option value="status">Agrupar por estado</option>
              <option value="category">Agrupar por categoría</option>
            </select>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Total</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Pendientes</p>
          <p className="text-xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">En Progreso</p>
          <p className="text-xl font-bold text-brand-navy">{stats.inProgress}</p>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Completadas</p>
          <p className="text-xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white border border-red-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Vencidas</p>
          <p className="text-xl font-bold text-red-600">{stats.overdue}</p>
        </div>
        <div className="bg-white border border-yellow-200 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Urgentes</p>
          <p className="text-xl font-bold text-yellow-600">{stats.urgent}</p>
        </div>
        <div className="bg-white border border-brand-blue/30 p-3 rounded-lg">
          <p className="text-xs text-gray-600">Para Hoy</p>
          <p className="text-xl font-bold text-brand-navy">{stats.today}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-2">
          <span className="text-sm text-gray-600 py-2">Estado:</span>
          {(['all', 'pending', 'in-progress', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === status
                  ? 'bg-brand-navy text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'Todas' : 
               status === 'pending' ? 'Pendientes' :
               status === 'in-progress' ? 'En Progreso' :
               'Completadas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-4">
          <span className="text-sm text-gray-600 py-2">Prioridad:</span>
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((priority) => (
            <button
              key={priority}
              onClick={() => setPriorityFilter(priority)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                priorityFilter === priority
                  ? 'bg-brand-navy text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {priority === 'all' ? 'Todas' : getPriorityName(priority)}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <p className="text-gray-500">Cargando tareas...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <List className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No hay tareas en esta categoría</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-brand-navy hover:text-brand-blue text-sm font-medium"
            >
              + Crear tarea
            </button>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
            <div key={groupName} className="bg-white rounded-xl shadow-sm">
              {groupMode !== 'none' && (
                <div className="px-6 py-3 border-b bg-gray-50 rounded-t-xl">
                  <h3 className="font-semibold text-gray-900">{groupName}</h3>
                  <p className="text-sm text-gray-600">{groupTasks.length} {groupTasks.length === 1 ? 'tarea' : 'tareas'}</p>
                </div>
              )}
              <div className="divide-y">
                {groupTasks.map((task) => {
                  const urgency = getTaskUrgency(task);
                  return (
                    <div
                      key={task.id}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        urgency === 'overdue' ? 'bg-red-50' :
                        urgency === 'urgent' ? 'bg-yellow-50' :
                        urgency === 'today' ? 'bg-brand-blue/10' : ''
                      }`}
                      onClick={() => setShowTaskDetail(task)}
                    >
                      <div className="flex items-start gap-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task);
                          }}
                          className="mt-1 flex-shrink-0"
                        >
                          {getStatusIcon(task.status)}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3
                                className={`font-semibold text-gray-900 ${
                                  task.status === 'completed' ? 'line-through text-gray-500' : ''
                                }`}
                              >
                                {task.title}
                                {urgency === 'overdue' && (
                                  <span className="ml-2 text-xs text-red-600 font-normal">VENCIDA</span>
                                )}
                                {urgency === 'today' && (
                                  <span className="ml-2 text-xs text-brand-navy font-normal">HOY</span>
                                )}
                              </h3>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                                  {getPriorityName(task.priority)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {getStatusName(task.status)}
                                </span>
                                {task.dueDate && (
                                  <span className={`text-xs flex items-center gap-1 ${
                                    urgency === 'overdue' ? 'text-red-600 font-medium' :
                                    urgency === 'today' ? 'text-brand-navy font-medium' :
                                    'text-gray-500'
                                  }`}>
                                    <CalendarIcon className="w-3 h-3" />
                                    {format(task.dueDate, 'dd MMM yyyy', { locale: es })}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {task.category}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(task);
                                }}
                                className="p-2 text-brand-navy hover:bg-brand-blue/10 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(task.id);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Task Detail Modal */}
      {showTaskDetail && (
        <TaskDetailModal
          task={showTaskDetail}
          onClose={() => setShowTaskDetail(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={toggleTaskStatus}
          getPriorityColor={getPriorityColor}
          getPriorityName={getPriorityName}
          getStatusName={getStatusName}
          getTaskUrgency={getTaskUrgency}
        />
      )}

      {/* Task Form Modal */}
      {showModal && (
        <TaskFormModal
          isEditing={!!editingTask}
          formData={formData}
          onFormDataChange={setFormData}
          onSubmit={handleSubmit}
          onClose={resetForm}
        />
      )}
    </div>
  );
}
