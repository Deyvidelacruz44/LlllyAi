export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionExecuted?: boolean;
  actionType?: 'event' | 'task';
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface AIAction {
  action:
    | 'create_event'
    | 'create_task'
    | 'create_transaction'
    | 'update_task'
    | 'delete_task'
    | 'update_event'
    | 'delete_event'
    | 'complete_task'
    | 'list_events'
    | 'list_tasks'
    | 'remember'
    | 'get_weather'
    | 'get_news'
    | 'search_web'
    | 'none';
  message: string;
  data?: {
    title?: string;
    description?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    day_of_week?: string;
    type?: string;
    priority?: string;
    status?: string;
    taskId?: string;
    eventId?: string;
    note?: string;
    // Finance fields
    amount?: number;
    category?: string;
    transaction_type?: 'income' | 'expense';
    account?: string;
    // User memory
    userName?: string;
    // Integration fields
    city?: string;
    query?: string;
  };
}

export type LiveVoiceState = 'idle' | 'listening' | 'processing' | 'speaking';
