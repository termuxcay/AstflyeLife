export namespace main {
	
	export class FinanceSummary {
	    income: number;
	    expenses: number;
	    balance: number;
	    period: string;
	
	    static createFrom(source: any = {}) {
	        return new FinanceSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.income = source["income"];
	        this.expenses = source["expenses"];
	        this.balance = source["balance"];
	        this.period = source["period"];
	    }
	}
	export class Task {
	    id: string;
	    user_discord_id: string;
	    title: string;
	    description: string;
	    status: string;
	    priority: string;
	    category: string;
	    recurrence: string;
	    due_date: string;
	    due_time: string;
	    notify_before: number;
	    completed_at: string;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_discord_id = source["user_discord_id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.priority = source["priority"];
	        this.category = source["category"];
	        this.recurrence = source["recurrence"];
	        this.due_date = source["due_date"];
	        this.due_time = source["due_time"];
	        this.notify_before = source["notify_before"];
	        this.completed_at = source["completed_at"];
	        this.created_at = source["created_at"];
	    }
	}
	export class TaskInput {
	    title: string;
	    description: string;
	    status: string;
	    priority: string;
	    category: string;
	    recurrence: string;
	    due_date: string;
	    due_time: string;
	    notify_before: number;
	
	    static createFrom(source: any = {}) {
	        return new TaskInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.priority = source["priority"];
	        this.category = source["category"];
	        this.recurrence = source["recurrence"];
	        this.due_date = source["due_date"];
	        this.due_time = source["due_time"];
	        this.notify_before = source["notify_before"];
	    }
	}
	export class Transaction {
	    id: string;
	    user_discord_id: string;
	    type: string;
	    amount: number;
	    currency: string;
	    category: string;
	    description: string;
	    recurring: boolean;
	    recurring_period: string;
	    date: string;
	    created_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Transaction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user_discord_id = source["user_discord_id"];
	        this.type = source["type"];
	        this.amount = source["amount"];
	        this.currency = source["currency"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.recurring = source["recurring"];
	        this.recurring_period = source["recurring_period"];
	        this.date = source["date"];
	        this.created_at = source["created_at"];
	    }
	}
	export class TransactionInput {
	    type: string;
	    amount: number;
	    currency: string;
	    category: string;
	    description: string;
	    recurring: boolean;
	    recurring_period: string;
	    date: string;
	
	    static createFrom(source: any = {}) {
	        return new TransactionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.amount = source["amount"];
	        this.currency = source["currency"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.recurring = source["recurring"];
	        this.recurring_period = source["recurring_period"];
	        this.date = source["date"];
	    }
	}

}

