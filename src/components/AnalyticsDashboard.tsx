// File: src/components/AnalyticsDashboard.tsx
// Updated to use Recharts for more advanced and interactive charts.

import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    BarChart, Bar,
    PieChart, Pie, Cell,
    LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'; // Assuming recharts is installed

import { AirdropTask } from '../types';
// Icon component is not directly used in this version of AnalyticsDashboard
// If icons were needed for chart elements, they'd be imported.

interface AnalyticsDashboardProps {
  tasks: AirdropTask[];
  userId: string | null;
}

const PIE_CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];
const LINE_CHART_COLOR = '#8884d8'; // Example color for line chart

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tasks, userId }) => {
    const analyticsData = useMemo(() => {
      if (!tasks || tasks.length === 0 || !userId) return null;

      const activeTasks = tasks.filter(t => t.isActive);
      const completedOnceCount = activeTasks.filter(t => t.lastCompleted).length;
      const overallCompletionRate = activeTasks.length > 0 ? (completedOnceCount / activeTasks.length) * 100 : 0;

      const tasksByCategory = activeTasks.reduce((acc, task) => {
        acc[task.category] = (acc[task.category] || 0) + 1; return acc;
      }, {} as Record<string, number>);
      const categoryDistributionData = Object.entries(tasksByCategory).map(([name, value]) => ({ name, value }));

      const tasksByPriority = activeTasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1; return acc;
      }, {} as Record<string, number>);
      const priorityDistributionData = Object.entries(tasksByPriority).map(([name, value]) => ({ name, value }));
      
      const averageStreak = activeTasks.length > 0 ? activeTasks.reduce((sum, t) => sum + t.streak, 0) / activeTasks.length : 0;
      const longestStreak = activeTasks.length > 0 ? Math.max(0, ...activeTasks.map(t => t.streak)) : 0;

      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const completedLast7Days = tasks.filter(t => t.lastCompleted && new Date(t.lastCompleted) >= sevenDaysAgo).length;

      const completionTrendData = (() => {
          const trend: {date: string, completed: number}[] = []; 
          const today = new Date();
          for (let i = 6; i >= 0; i--) { // Last 7 days including today
              const date = new Date(today); date.setDate(today.getDate() - i);
              const dateString = date.toLocaleDateString('en-CA'); 
              const completedOnDate = tasks.filter(task => task.lastCompleted && new Date(task.lastCompleted).toLocaleDateString('en-CA') === dateString).length;
              trend.push({ date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), completed: completedOnDate });
          }
          return trend;
      })();

      return {
        overallCompletionRate: overallCompletionRate.toFixed(1), totalActiveTasks: activeTasks.length, completedOnceCount,
        categoryDistribution: categoryDistributionData, priorityDistribution: priorityDistributionData,
        averageStreak: averageStreak.toFixed(1), longestStreak, completedLast7Days, completionTrend: completionTrendData,
      };
    }, [tasks, userId]);

    if (!analyticsData) {
      return React.createElement('div', { className: "p-6 text-center text-gray-400" }, 
        userId ? (tasks.length === 0 ? "No task data available to generate analytics." : "Calculating analytics...") : "Sign in to view analytics."
      );
    }
    
    // Custom Tooltip for Pie Charts for better styling
    const CustomPieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                React.createElement('div', { className: "p-2 bg-gray-700/80 backdrop-blur-sm text-white rounded-md shadow-lg border border-gray-600 text-sm" },
                    React.createElement('p', { className: "font-semibold" }, `${payload[0].name}`),
                    React.createElement('p', null, `Tasks: ${payload[0].value} (${(payload[0].percent * 100).toFixed(0)}%)`)
                )
            );
        }
        return null;
    };


    return (
        React.createElement('div', { className: "p-4 md:p-6 space-y-6 md:space-y-8 animate-fade-in" },
          React.createElement('h2', { className: "text-2xl sm:text-3xl font-bold text-white border-b border-gray-700 pb-3 mb-6" }, "Airdrop Analytics"),
          
          React.createElement('div', { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" },
            React.createElement('div', { className: "analytics-card" },
              React.createElement('h3', { className: "analytics-title" }, "Completion Rate"),
              React.createElement('p', { className: "analytics-value text-green-400" }, `${analyticsData.overallCompletionRate}%`),
              React.createElement('p', { className: "analytics-subtext" }, `(${analyticsData.completedOnceCount} of ${analyticsData.totalActiveTasks} active tasks completed once)`)
            ),
            React.createElement('div', { className: "analytics-card" },
              React.createElement('h3', { className: "analytics-title" }, "Average Streak"),
              React.createElement('p', { className: "analytics-value text-yellow-400" }, analyticsData.averageStreak),
              React.createElement('p', { className: "analytics-subtext" }, `Longest: ${analyticsData.longestStreak} days`)
            ),
            React.createElement('div', { className: "analytics-card" },
              React.createElement('h3', { className: "analytics-title" }, "Completed (Last 7 Days)"),
              React.createElement('p', { className: "analytics-value text-blue-400" }, analyticsData.completedLast7Days)
            )
          ),

          React.createElement('div', { className: "grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8" },
            // Tasks by Category Pie Chart
            React.createElement('div', {className: "bg-gray-800/50 p-5 rounded-xl shadow-lg"},
                React.createElement('h3', {className: "text-lg font-semibold text-gray-200 mb-4"}, "Tasks by Category"),
                analyticsData.categoryDistribution.length > 0 ?
                React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                    React.createElement(PieChart, null,
                        React.createElement(Pie, { 
                            data: analyticsData.categoryDistribution, 
                            cx: "50%", cy: "50%", 
                            labelLine: false,
                            // label: ({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`, // Example label
                            outerRadius: 100, 
                            fill: "#8884d8", 
                            dataKey: "value",
                            nameKey: "name"
                        },
                            analyticsData.categoryDistribution.map((entry, index) => 
                                React.createElement(Cell, { key: `cell-${index}`, fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length] })
                            )
                        ),
                        React.createElement(Tooltip, { content: React.createElement(CustomPieTooltip, null) }),
                        React.createElement(Legend, { verticalAlign: "bottom", height: 36, wrapperStyle: { color: '#9CA3AF' }})
                    )
                ) : React.createElement('p', {className: "text-gray-500 text-center py-10"}, "No category data available.")
            ),
            // Tasks by Priority Pie Chart
            React.createElement('div', {className: "bg-gray-800/50 p-5 rounded-xl shadow-lg"},
                React.createElement('h3', {className: "text-lg font-semibold text-gray-200 mb-4"}, "Tasks by Priority"),
                 analyticsData.priorityDistribution.length > 0 ?
                React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                    React.createElement(PieChart, null,
                        React.createElement(Pie, { 
                            data: analyticsData.priorityDistribution, 
                            cx: "50%", cy: "50%", 
                            labelLine: false,
                            outerRadius: 100, 
                            fill: "#82ca9d", 
                            dataKey: "value",
                            nameKey: "name"
                        },
                            analyticsData.priorityDistribution.map((entry, index) => 
                                React.createElement(Cell, { key: `cell-${index}`, fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length] })
                            )
                        ),
                        React.createElement(Tooltip, { content: React.createElement(CustomPieTooltip, null) }),
                        React.createElement(Legend, { verticalAlign: "bottom", height: 36, wrapperStyle: { color: '#9CA3AF' }})
                    )
                ) : React.createElement('p', {className: "text-gray-500 text-center py-10"}, "No priority data available.")
            )
          ),
          
          // Daily Completions Bar Chart (or Line Chart)
          React.createElement('div', {className: "bg-gray-800/50 p-5 rounded-xl shadow-lg"},
            React.createElement('h3', {className: "text-lg font-semibold text-gray-200 mb-4"}, "Daily Completions (Last 7 Days)"),
            analyticsData.completionTrend.length > 0 ?
            React.createElement(ResponsiveContainer, { width: "100%", height: 300 },
                React.createElement(LineChart, { data: analyticsData.completionTrend, margin: { top: 5, right: 20, left: -10, bottom: 5 } },
                    React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "#374151" }), // stroke-gray-700
                    React.createElement(XAxis, { dataKey: "date", stroke: "#9CA3AF", tick: { fontSize: 12 } }), // stroke-gray-400
                    React.createElement(YAxis, { stroke: "#9CA3AF", allowDecimals: false, tick: { fontSize: 12 } }),
                    React.createElement(Tooltip, { 
                        contentStyle: { backgroundColor: 'rgba(31, 41, 55, 0.9)', border: '1px solid #4B5563', borderRadius: '0.375rem' }, // bg-gray-800/90, border-gray-600
                        itemStyle: { color: '#E5E7EB' }, // text-gray-200
                        labelStyle: { color: '#FFFFFF', fontWeight: 'bold' } // text-white
                    }),
                    React.createElement(Legend, { wrapperStyle: { color: '#9CA3AF' }}),
                    React.createElement(Line, { type: "monotone", dataKey: "completed", name: "Tasks Completed", stroke: LINE_CHART_COLOR, strokeWidth: 2, activeDot: { r: 6 }, dot: { r: 4 } })
                )
            ) : React.createElement('p', {className: "text-gray-500 text-center py-10"}, "No completion trend data available.")
          )
        )
      );
};

export default AnalyticsDashboard;
