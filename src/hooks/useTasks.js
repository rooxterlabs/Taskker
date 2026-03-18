import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { calculateTargetDeadline, getPriorityFromDueByType, isTaskOverdue } from '../utils/dateUtils';

// Helper to calculate stats from tasks array
const calculateStats = (tasks) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return {
        // Since due_by_type handles "Today", we can count those. Or anything not done and not overdue but due today.
        p1: tasks.filter(t => t.priority && t.priority.includes('P1') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        p2: tasks.filter(t => t.priority && t.priority.includes('P2') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        p3: tasks.filter(t => t.priority && t.priority.includes('P3') && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        backburner: tasks.filter(t => t.priority === 'Backburner' && t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived).length,
        // Completed only in last 7 days
        completed: tasks.filter(t => {
            if (t.status !== 'Done') return false;
            // Best effort to find completion time, fallback to submitted_on or created
            const compDate = t.deletion_date || t.submitted_on || t.created_at || t.date;
            return new Date(compDate) >= sevenDaysAgo;
        }).length,
        overdue: tasks.filter(t => t.status !== 'Done' && t.status !== 'Deleted' && !t.is_archived && isTaskOverdue(t.target_deadline)).length
    };
};

export function useTasks() {
    const [tasks, setTasks] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tasksResult, teamsResult, categoriesResult, profilesResult] = await Promise.all([
                supabase.from('tasks').select('*').order('id', { ascending: false }),
                supabase.from('team_members').select('*').order('name', { ascending: true }),
                supabase.from('categories').select('*').order('name', { ascending: true }),
                supabase.from('profiles').select('email, role')
            ]);

            if (tasksResult.error) throw tasksResult.error;
            if (teamsResult.error) throw teamsResult.error;
            if (categoriesResult.error) throw categoriesResult.error;

            setTasks(tasksResult.data || []);
            setCategories(categoriesResult.data || []);

            // Merge role data into teamMembers for UI logic
            const profiles = profilesResult.data || [];
            const mergedRoster = (teamsResult.data || []).map(member => {
                const profile = profiles.find(p => p.email?.toLowerCase() === member.email?.toLowerCase());
                return {
                    ...member,
                    role: profile?.role || 'worker' // Default to worker if profile not found yet
                };
            });
            setTeamMembers(mergedRoster);

            // 30-Day Trash Cleanup Logic
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const tasksToDelete = (tasksResult.data || []).filter(t =>
                t.status === 'Deleted' &&
                t.deletion_date &&
                new Date(t.deletion_date) < thirtyDaysAgo
            ).map(t => t.id);

            if (tasksToDelete.length > 0) {
                await supabase.from('tasks').delete().in('id', tasksToDelete);
                console.log(`Cleaned up ${tasksToDelete.length} permanently deleted tasks.`);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const addTeamMember = async (name, email = null) => {
        const id = crypto.randomUUID();
        const newMember = { id, name };
        if (email) newMember.email = email;
        
        setTeamMembers(prev => [...prev, newMember]);

        const { data, error } = await supabase
            .from('team_members')
            .insert([newMember])
            .select();

        if (error) {
            console.error('Error adding team member:', error);
            // Optionally remove optimistic object on error, skipping fetchData to avoid blocking UI
        } else if (data) {
            setTeamMembers(prev => prev.map(m => m.id === id ? data[0] : m));
        }
        return data;
    };

    const deleteTeamMember = async (member) => {
        // Remove from UI
        setTeamMembers(prev => prev.filter(m => m.id !== member.id));

        // Move all their tasks to Archive
        setTasks(prev => prev.map(t => t.assignee === member.name ? { ...t, is_archived: true } : t));

        // DB Updates
        const { error: tasksError } = await supabase
            .from('tasks')
            .update({ is_archived: true })
            .eq('assignee', member.name);

        const { error: memError } = await supabase
            .from('team_members')
            .delete()
            .eq('id', member.id);

        if (tasksError || memError) {
            console.error('Error deleting team member:', tasksError || memError);
            fetchData();
        }
    };

    const updateTeamMember = async (id, newName) => {
        const member = teamMembers.find(m => m.id === id);
        if (!member) return;
        const oldName = member.name;

        // UI Optimistic
        setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, name: newName } : m));
        setTasks(prev => prev.map(t => t.assignee === oldName ? { ...t, assignee: newName } : t));

        const { error: mErr } = await supabase.from('team_members').update({ name: newName }).eq('id', id);
        const { error: tErr } = await supabase.from('tasks').update({ assignee: newName }).eq('assignee', oldName);

        if (mErr || tErr) fetchData();
    };

    const addCategory = async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const id = crypto.randomUUID();
        const newCategory = { id, name: trimmed };
        setCategories(prev => [...prev, newCategory]);

        const { data, error } = await supabase
            .from('categories')
            .insert([newCategory])
            .select();

        if (error) {
            console.error('Error adding category:', error);
            // Optionally fallback optimistic state
        } else if (data) {
            setCategories(prev => prev.map(c => c.id === id ? data[0] : c));
        }
        return data;
    };

    const deleteCategory = async (id) => {
        setCategories(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) {
            console.error('Error deleting category:', error);
            fetchData();
        }
    };

    const addTask = async (assignee, userRole) => {
        const dueByType = 'This Week'; // Default
        const defaultCategory = categories.length > 0 ? categories[0].name : '';
        const id = crypto.randomUUID();

        // Extract assignee info
        const assigneeMember = teamMembers.find(m => m.name === assignee);
        const assignee_id = assigneeMember ? assigneeMember.user_id : null;
        const assignee_email = assigneeMember ? assigneeMember.email : null;

        const newTask = {
            id,
            status: 'To Do',
            action: '',
            category: defaultCategory,
            due_by_type: dueByType,
            priority: getPriorityFromDueByType(dueByType),
            target_deadline: calculateTargetDeadline(dueByType),
            submitted_on: new Date().toISOString(),
            assignee: assignee,
            assignee_id: assignee_id,
            assignee_email: assignee_email,
            is_archived: false,
            created_by_role: userRole || 'super_admin' // Track who created it physically
        };

        // UI Optimistic
        setTasks(prev => [newTask, ...prev]);

        // Only insert DB schema compatible fields
        const { error } = await supabase
            .from('tasks')
            .insert([newTask]);

        if (error) {
            console.error('Error adding task:', error);
            // Do not call fetchData immediately to avoid UI locking. Let UI hold optimistic tasks.
        }

        return newTask;
    };

    const updateTask = async (id, fieldOrObject, value) => {
        let updates = {};

        // Support bulk updates where fieldOrObject is an object
        if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
            updates = { ...fieldOrObject };
        } else {
            updates = { [fieldOrObject]: value };
        }

        // If due_by_type changes, we must auto-calculate priority and target_deadline
        if (updates.due_by_type) {
            updates.priority = getPriorityFromDueByType(updates.due_by_type);
            updates.target_deadline = calculateTargetDeadline(updates.due_by_type);
        }

        // Handle assignee mapping for the new schema
        if (updates.assignee) {
            const assigneeMember = teamMembers.find(m => m.name === updates.assignee);
            if (assigneeMember) {
                updates.assignee_id = assigneeMember.user_id;
                updates.assignee_email = assigneeMember.email;
            } else {
                updates.assignee_id = null;
                updates.assignee_email = null;
            }
        }

        // Filter valid schema columns (including the new created_by_role, assignee_id, assignee_email)
        const validSchemaKeys = [
            'action', 'assignee', 'assignee_id', 'assignee_email', 'category', 'due_by_type', 'priority',
            'status', 'is_archived', 'target_deadline', 'submitted_on', 'deletion_date', 'created_by_role'
        ];
        const dbUpdates = {};
        for (const [key, val] of Object.entries(updates)) {
            if (validSchemaKeys.includes(key)) {
                dbUpdates[key] = val;
            }
        }

        // Optimistic UI update
        setTasks(prevTasks => prevTasks.map(t => t.id === id ? { ...t, ...updates } : t));

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase
                .from('tasks')
                .update(dbUpdates)
                .eq('id', id);

            if (error) {
                console.error('Error updating task:', error);
                // Do not blindly call fetchData on every keystroke error to prevent the global loading state
            }
        }
    };

    const deleteTask = async (id) => {
        setTasks(tasks.filter(t => t.id !== id));
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) {
            console.error('Error permanently deleting task:', error);
            fetchData();
        }
    };

    const permanentlyDeleteTask = async (id) => {
        return deleteTask(id);
    };

    const resetData = async () => {
        if (confirm('Reload data from server?')) {
            fetchData();
        }
    };

    const stats = useMemo(() => calculateStats(tasks), [tasks]);

    return {
        tasks,
        teamMembers,
        categories,
        stats,
        addTask,
        addTeamMember,
        deleteTeamMember,
        updateTeamMember,
        addCategory,
        deleteCategory,
        updateTask,
        deleteTask,
        permanentlyDeleteTask,
        resetData,
        loading
    };
}
