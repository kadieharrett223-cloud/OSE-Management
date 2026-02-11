"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";

interface TeamTask {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  status: "todo" | "in-progress" | "done";
  dueDate?: string;
  priority: "low" | "medium" | "high";
}

export default function TeamTasksPage() {
  const [tasks, setTasks] = useState<TeamTask[]>([
    {
      id: "1",
      title: "Review February invoices",
      description: "Check all paid invoices for accuracy",
      assignee: "Kadie",
      status: "in-progress",
      dueDate: "2026-02-15",
      priority: "high",
    },
    {
      id: "2",
      title: "Reconcile vendor payments",
      description: "Verify all vendor payments match QBO records",
      assignee: "Admin",
      status: "todo",
      dueDate: "2026-02-28",
      priority: "medium",
    },
    {
      id: "3",
      title: "Follow up on outstanding invoices",
      description: "Contact customers with unpaid invoices",
      assignee: "Sales Team",
      status: "todo",
      dueDate: "2026-02-20",
      priority: "high",
    },
  ]);

  const [newTask, setNewTask] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddTask = () => {
    if (!newTask.trim()) return;
    const task: TeamTask = {
      id: Date.now().toString(),
      title: newTask,
      status: "todo",
      priority: "medium",
    };
    setTasks([...tasks, task]);
    setNewTask("");
    setShowAddModal(false);
  };

  const handleStatusChange = (id: string, newStatus: TeamTask["status"]) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
  };

  const handleDelete = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const getStatusColor = (status: TeamTask["status"]) => {
    switch (status) {
      case "todo":
        return "bg-slate-100 text-slate-700";
      case "in-progress":
        return "bg-blue-100 text-blue-700";
      case "done":
        return "bg-emerald-100 text-emerald-700";
    }
  };

  const getPriorityColor = (priority: TeamTask["priority"]) => {
    switch (priority) {
      case "low":
        return "text-slate-500";
      case "medium":
        return "text-amber-600";
      case "high":
        return "text-red-600";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar activePage="Team Tasks" />

        <main className="flex-1 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-900">
          <div className="mx-auto max-w-7xl px-8 py-6 space-y-6">
            <header className="space-y-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">Operations</p>
                <h1 className="text-3xl font-semibold text-slate-900">Team Tasks</h1>
                <p className="text-sm text-slate-600">Keep the team aligned on priorities and deadlines.</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Add Task
              </button>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* To Do */}
              <div className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">To Do ({todoTasks.length})</h2>
                <div className="space-y-3">
                  {todoTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900">{task.title}</h3>
                          {task.description && <p className="mt-1 text-xs text-slate-600">{task.description}</p>}
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs font-semibold ${getPriorityColor(task.priority)} capitalize`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <span className="text-xs text-slate-500">
                                Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TeamTask["status"])}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-400"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* In Progress */}
              <div className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">In Progress ({inProgressTasks.length})</h2>
                <div className="space-y-3">
                  {inProgressTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900">{task.title}</h3>
                          {task.description && <p className="mt-1 text-xs text-slate-600">{task.description}</p>}
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs font-semibold ${getPriorityColor(task.priority)} capitalize`}>
                              {task.priority}
                            </span>
                            {task.assignee && <span className="text-xs text-slate-600">Assigned to {task.assignee}</span>}
                          </div>
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TeamTask["status"])}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-400"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done */}
              <div className="rounded-xl bg-white p-5 shadow-md ring-1 ring-slate-200">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Done ({doneTasks.length})</h2>
                <div className="space-y-3">
                  {doneTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 line-through">{task.title}</h3>
                          {task.description && <p className="mt-1 text-xs text-slate-600">{task.description}</p>}
                        </div>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TeamTask["status"])}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-400"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="mt-2 text-xs text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Add New Task</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task title"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
