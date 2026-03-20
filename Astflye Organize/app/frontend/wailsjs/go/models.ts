export namespace main {
  export interface FinanceSummary {
    income: number;
    expenses: number;
    balance: number;
    period: string;
  }
  export interface Task {
    id: string;
    user_discord_id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    recurrence: string;
    due_date: string;
    completed_at: string;
    created_at: string;
  }
  export interface TaskInput {
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    recurrence: string;
    due_date: string;
  }
  export interface Transaction {
    id: string;
    user_discord_id: string;
    type: string;
    amount: number;
    currency: string;
    category: string;
    description: string;
    recurring: boolean;
    date: string;
    created_at: string;
  }
  export interface TransactionInput {
    type: string;
    amount: number;
    currency: string;
    category: string;
    description: string;
    recurring: boolean;
    date: string;
  }
}
